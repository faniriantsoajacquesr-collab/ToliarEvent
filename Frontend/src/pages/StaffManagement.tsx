import { useState, useMemo, useEffect, useCallback } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';
import StaffTable from '../components/StaffTable';
import StaffModal from '../components/StaffModal';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import { useToast } from '../contexts/ToastContext';

interface StaffMember {
  id: number; // organization_members.id
  organization_id: string;
  profile_id: string;
  role: 'admin' | 'staff'; // organization_members.role
  is_validated: boolean; // organization_members.is_validated
  created_at: string;
  profile: {
    id: string; // profiles.id
    first_name: string;
    last_name: string;
    phone?: string;
  };
  profile_skills?: Array<{ skill_id: number; name: string }>;
}

export default function StaffManagement({ selectedEventId }: { selectedEventId?: string | null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'validated' | 'rejected'>('all');
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { session } = useAuth();
  const { showToast } = useToast();

  const fetchStaffMembers = useCallback(async () => {
    if (!session?.access_token) return;

    setIsLoading(true);
    try {
      // If an event is selected, load event_staff rows (applications) and use profiles for user data
      if (selectedEventId) {
        const eventStatusMap = {
          all: 'all',
          pending: 'en_attente',
          validated: 'valide',
          rejected: 'refuse',
        } as const;
        const res = await authAPI.getEventApplications(
          selectedEventId,
          session.access_token,
          eventStatusMap[statusFilter]
        );
        console.debug('getEventApplications response:', res);
        if (res && res.success) {
          const normalized = (res.staff || []).map((s: any) => ({
            id: s.id,
            status: s.status,
            created_at: s.created_at,
            post: s.post || '—',
            profile: s.profile ?? s.profiles ?? null,
          }));
          setStaffMembers(normalized);
          setSelectedStaffIds(new Set());
          // Also set organizationId based on myOrganization for actions that need it
          const orgRes = await authAPI.getMyOrganization(session.access_token);
          if (orgRes.success && orgRes.organization) setOrganizationId(orgRes.organization.id);
        } else if (res?.error === 'Accès refusé' || res?.error?.toString().toLowerCase().includes('accès refusé')) {
          console.debug('getEventApplications access denied, falling back to organization members');
          const orgRes = await authAPI.getMyOrganization(session.access_token);
          if (orgRes.success && orgRes.organization) {
            setOrganizationId(orgRes.organization.id);
            const membersRes = await authAPI.getOrganizationMembers(
              orgRes.organization.id,
              searchQuery,
              statusFilter === 'pending' ? 'pending' : statusFilter === 'validated' ? 'validated' : 'all',
              session.access_token
            );
            if (membersRes.success) {
              const normalized = (membersRes.members || []).map((m: any) => ({
                ...m,
                profile: m.profiles ?? m.profile ?? null,
                status: m.is_validated ? 'valide' : 'en_attente',
                post: m.role === 'admin' ? 'Administrateur' : 'Staff',
              }));
              setStaffMembers(normalized);
              setSelectedStaffIds(new Set());
            } else {
              showToast(membersRes.error || 'Erreur lors du chargement des membres du staff.', 'error');
            }
          } else {
            showToast('Impossible de récupérer l\'organisation.', 'error');
          }
        } else {
          console.warn('getEventApplications failed or malformed response', res);
          showToast((res && res.error) || 'Erreur lors du chargement du staff de l\'événement.', 'error');
          setStaffMembers([]);
        }
      } else {
        const orgRes = await authAPI.getMyOrganization(session.access_token);
        if (!orgRes.success || !orgRes.organization) {
          setStaffMembers([]);
          showToast('Impossible de récupérer l\'organisation.', 'error');
          return;
        }
        setOrganizationId(orgRes.organization.id);

        const orgFilter =
          statusFilter === 'pending'
            ? 'pending'
            : statusFilter === 'validated'
              ? 'validated'
              : 'all';
        const res = await authAPI.getOrganizationMembers(
          orgRes.organization.id,
          searchQuery,
          orgFilter,
          session.access_token
        );
        if (res.success) {
          const normalized = (res.members || []).map((m: any) => ({
            ...m,
            profile: m.profiles ?? m.profile ?? null,
            status: m.is_validated ? 'valide' : 'en_attente',
            post: m.role === 'admin' ? 'Administrateur' : 'Staff',
          }));
          setStaffMembers(normalized);
          setSelectedStaffIds(new Set());
        } else {
          showToast(res.error || 'Erreur lors du chargement des membres du staff.', 'error');
        }
      }
    } catch (err) {
      console.error('Fetch staff error:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [session, searchQuery, statusFilter, showToast, selectedEventId]);

  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  const filteredStaff = useMemo(() => {
    // Filtering is now handled by the backend API call based on searchQuery and showOnlyToValidate
    return staffMembers;
  }, [staffMembers]);

  // KPIs: if viewing event_staff (selectedEventId present) compute from event_staff.status,
  // otherwise compute from organization_members fields.
  const totalStaff = staffMembers.length;

  const toValidateCount = selectedEventId
    ? staffMembers.filter((s: any) => String(s.status).toLowerCase() === 'en_attente').length
    : staffMembers.filter((s) => !s.is_validated).length;

  const handleOpenModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  const handleSaveStaff = async (updatedStaff: StaffMember) => {
    if (!session?.access_token || !organizationId) return;
    try {
      const res = await authAPI.updateOrganizationMember(updatedStaff.id, {
        role: updatedStaff.role,
        is_validated: updatedStaff.is_validated,
      }, session.access_token);
      if (res.success) {
        showToast('Membre du staff mis à jour avec succès.', 'success');
        fetchStaffMembers(); // Refresh the list
      } else {
        showToast(res.error || 'Erreur lors de la mise à jour du membre.', 'error');
      }
    } catch (err) {
      console.error('Update staff error:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    }
  };

  const handleDeleteStaff = async (memberId: number) => {
    if (!session?.access_token) return;
    if (!confirm('Voulez-vous vraiment supprimer ce membre du staff ?')) return;
    try {
      if (selectedEventId) {
        // Deleting an event application
        const res = await authAPI.deleteEventStaff(memberId, session.access_token);
        if (res.success) {
          showToast('Candidature supprimée avec succès.', 'success');
          fetchStaffMembers();
        } else {
          showToast(res.error || 'Erreur lors de la suppression de la candidature.', 'error');
        }
      } else {
        if (!organizationId) return;
        const res = await authAPI.deleteOrganizationMember(memberId, session.access_token);
        if (res.success) {
          showToast('Membre du staff supprimé avec succès.', 'success');
          fetchStaffMembers();
        } else {
          showToast(res.error || 'Erreur lors de la suppression du membre.', 'error');
        }
      }
    } catch (err) {
      console.error('Delete staff error:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    }
  };

  const handleValidateStaff = async (memberId: number) => {
    if (!session?.access_token) return;
    try {
      if (selectedEventId) {
        const res = await authAPI.validateApplication(memberId, 'accept', session.access_token);
        if (res.success) {
          showToast('Candidature validée.', 'success');
          fetchStaffMembers();
        } else {
          showToast(res.error || 'Erreur lors de la validation de la candidature.', 'error');
        }
      } else {
        if (!organizationId) return;
        const res = await authAPI.updateOrganizationMember(memberId, { is_validated: true }, session.access_token);
        if (res.success) {
          showToast('Membre du staff validé avec succès.', 'success');
          fetchStaffMembers();
        } else {
          showToast(res.error || 'Erreur lors de la validation du membre.', 'error');
        }
      }
    } catch (err) {
      console.error('Validate staff error:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    }
  };

  const handleRejectStaff = async (memberId: number) => {
    if (!session?.access_token) return;
    if (!confirm('Voulez-vous vraiment refuser ce membre du staff ?')) return;
    try {
      if (selectedEventId) {
        const res = await authAPI.validateApplication(memberId, 'reject', session.access_token);
        if (res.success) {
          showToast('Candidature refusée.', 'success');
          fetchStaffMembers();
        } else {
          showToast(res.error || 'Erreur lors du refus de la candidature.', 'error');
        }
      } else {
        if (!organizationId) return;
        const res = await authAPI.deleteOrganizationMember(memberId, session.access_token);
        if (res.success) {
          showToast('Membre du staff refusé et supprimé.', 'success');
          fetchStaffMembers();
        } else {
          showToast(res.error || 'Erreur lors du refus du membre.', 'error');
        }
      }
    } catch (err) {
      console.error('Reject staff error:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    }
  };

  const handleBulkStaffAction = async (action: 'validate' | 'reject' | 'delete') => {
    if (!session?.access_token) return;
    const ids = Array.from(selectedStaffIds);
    if (ids.length === 0) return;

    const labels = {
      validate: 'valider',
      reject: 'refuser',
      delete: 'supprimer',
    };

    if (!confirm(`${labels[action].charAt(0).toUpperCase()}${labels[action].slice(1)} ${ids.length} profil${ids.length > 1 ? 's' : ''} sélectionné${ids.length > 1 ? 's' : ''} ?`)) {
      return;
    }

    setIsBulkProcessing(true);
    try {
      let response;
      if (selectedEventId) {
        const eventAction = action === 'validate' ? 'accept' : action === 'reject' ? 'reject' : 'delete';
        response = await authAPI.bulkEventStaffAction(ids, eventAction, session.access_token);
      } else {
        response = await authAPI.bulkOrganizationMembersAction(ids, action, session.access_token);
      }

      if (response.success) {
        showToast(response.message || 'Action groupée effectuée avec succès.', 'success');
        setSelectedStaffIds(new Set());
        fetchStaffMembers();
      } else {
        showToast(response.error || 'Erreur lors de l\'action groupée.', 'error');
      }
    } catch (err) {
      console.error('Bulk staff action error:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <>
      <main className="flex-1 pt-28 pb-xl px-gutter max-w-container-max mx-auto w-full overflow-y-auto overflow-x-hidden">
        {/* Page Title */}
        <div className="mb-xl fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">
                Gestion du Staff RH
              </h1>
              <p className="text-on-surface-variant font-body-md text-body-md mt-xs">
                  Supervisez vos équipes et validez les nouveaux profils pour les
                  événements de Toliara.
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-xl">
            {/* Total Staff Card */}
            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/30 shadow-sm flex items-center gap-lg fade-in-up hover-lift">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-4xl">group</span>
              </div>
              <div>
                <p className="text-on-surface-variant font-label-md text-label-md">
                  Effectif Total
                </p>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {totalStaff} membres
                </h2>
              </div>
            </div>

            {/* Alert Card */}
            <div
              className={`bg-surface-container-lowest p-lg rounded-xl border-2 border-error/20 shadow-sm flex items-center gap-lg relative overflow-hidden fade-in-up hover-lift ${
                toValidateCount > 0 ? 'pulse-soft' : ''
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error relative z-10">
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  error
                </span>
              </div>
              <div className="relative z-10">
                <p className="text-error font-label-md text-label-md font-bold uppercase tracking-wider">
                  Alerte RH
                </p>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {toValidateCount} profils à valider
                </h2>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-surface-container-lowest p-md md:p-lg rounded-xl border border-outline-variant/30 shadow-sm mb-lg fade-in-up">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                  search
                </span>
                <input
                  className="w-full pl-10 pr-md py-sm bg-surface-bright border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-body-md transition-all"
                  placeholder="Rechercher par nom, rôle..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative w-full sm:w-48">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                  filter_list
                </span>
                <select
                  className="w-full pl-9 pr-8 py-2 bg-surface-bright border border-outline-variant rounded-lg text-xs font-semibold appearance-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="validated">Validés</option>
                  {selectedEventId && <option value="rejected">Refusés</option>}
                </select>
              </div>
            </div>
          </div>

          {selectedStaffIds.size > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-lg">
              <span className="text-sm font-medium text-primary">
                {selectedStaffIds.size} profil{selectedStaffIds.size > 1 ? 's' : ''} sélectionné{selectedStaffIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaffIds(new Set())}
                  disabled={isBulkProcessing}
                  className="rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition disabled:opacity-50"
                >
                  Désélectionner
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStaffAction('validate')}
                  disabled={isBulkProcessing}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  Valider la sélection
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStaffAction('reject')}
                  disabled={isBulkProcessing}
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 transition disabled:opacity-50"
                >
                  Refuser la sélection
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStaffAction('delete')}
                  disabled={isBulkProcessing}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  Supprimer la sélection
                </button>
              </div>
            </div>
          )}

          {/* Staff Table */}
          {isLoading && <LoadingOverlay message="Chargement des membres du staff..." />}
          {!isLoading && (
            <StaffTable
              staffData={filteredStaff}
              selectedIds={selectedStaffIds}
              onSelectionChange={setSelectedStaffIds}
              onRowClick={handleOpenModal}
              onDeleteStaff={handleDeleteStaff}
              onValidateStaff={handleValidateStaff}
              onRejectStaff={handleRejectStaff}
            />
          )}
        {/* Footer */}
        <footer className="w-full bg-surface-container-low border-t border-outline-variant/30 mt-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg px-gutter py-xl max-w-container-max mx-auto">
            <div>
              <div className="font-headline-md text-headline-md font-bold text-primary mb-md">
                ToliarEvent
              </div>
              <p className="text-on-surface-variant font-body-md text-body-md">
                © 2024 ToliarEvent. Precision logistics for the heart of Toliara.
              </p>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-bold text-on-surface mb-md">
                Quick Links
              </h4>
              <ul className="space-y-sm">
                <li>
                  <a
                    className="text-on-surface-variant font-body-md text-body-md hover:text-primary underline"
                    href="#"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    className="text-on-surface-variant font-body-md text-body-md hover:text-primary underline"
                    href="#"
                  >
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-bold text-on-surface mb-md">
                Resources
              </h4>
              <ul className="space-y-sm">
                <li>
                  <a
                    className="text-on-surface-variant font-body-md text-body-md hover:text-primary underline"
                    href="#"
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    className="text-on-surface-variant font-body-md text-body-md hover:text-primary underline"
                    href="#"
                  >
                    Local Logistics
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-bold text-on-surface mb-md">
                Contact
              </h4>
              <p className="text-on-surface-variant font-body-md text-body-md">
                Toliara, Madagascar
              </p>
              <p className="text-on-surface-variant font-body-md text-body-md">
                contact@toliarevent.mg
              </p>
            </div>
          </div>
        </footer>
      </main>

      <StaffModal
        isOpen={isModalOpen}
        staff={selectedStaff}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStaff}
      />
    </>
  );
}
