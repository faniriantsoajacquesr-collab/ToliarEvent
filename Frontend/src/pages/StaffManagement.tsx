import { useState, useMemo, useEffect, useCallback } from 'react';
import { TablePageSkeleton } from '../components/skeleton';
import AppPageHeader from '../components/AppPageHeader';
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
      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28 space-y-8">
          <AppPageHeader
            title="Gestion du Staff RH"
            subtitle="Supervisez vos équipes et validez les nouveaux profils pour les événements de Toliara."
          />

          <section>
            <p className="landing-eyebrow mb-4">Vue d&apos;ensemble</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dash-stat-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="dash-stat-label mb-1">Effectif total</p>
                    <p className="dash-stat-value">{totalStaff.toLocaleString('fr-FR')}</p>
                    <p className="text-xs app-text-muted mt-1">membre{totalStaff > 1 ? 's' : ''} actif{totalStaff > 1 ? 's' : ''}</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-primary opacity-80">group</span>
                </div>
              </div>

              <div className={`dash-stat-card ${toValidateCount > 0 ? 'border-amber-500/40 ring-1 ring-amber-500/20' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`dash-stat-label mb-1 ${toValidateCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      Alerte RH
                    </p>
                    <p className="dash-stat-value">{toValidateCount.toLocaleString('fr-FR')}</p>
                    <p className="text-xs app-text-muted mt-1">profil{toValidateCount > 1 ? 's' : ''} à valider</p>
                  </div>
                  <span
                    className={`material-symbols-outlined text-2xl opacity-80 ${toValidateCount > 0 ? 'text-amber-500' : 'text-red-400'}`}
                    style={toValidateCount > 0 ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {toValidateCount > 0 ? 'notification_important' : 'verified_user'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <p className="landing-eyebrow mb-2">Registre</p>
                <h2 className="font-landing-display text-xl app-heading">Liste des profils</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: 'all' as const, label: 'Tous les statuts' },
                    { value: 'pending' as const, label: 'En attente' },
                    { value: 'validated' as const, label: 'Validés' },
                    ...(selectedEventId ? [{ value: 'rejected' as const, label: 'Refusés' }] : []),
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`landing-chip ${statusFilter === option.value ? 'landing-chip--active' : ''}`}
                  >
                    {option.label}
                    {option.value === 'pending' && toValidateCount > 0 && (
                      <span className="ml-1 opacity-80">({toValidateCount})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="dash-toolbar">
              <div className="relative flex-1 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 app-text-muted text-lg pointer-events-none">search</span>
                <input
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm app-input bg-transparent border-0 focus:outline-none"
                  placeholder="Rechercher par nom, rôle…"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {selectedStaffIds.size > 0 && (
              <div className="dash-actions-panel !py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span className="text-sm font-semibold app-heading">
                    {selectedStaffIds.size} profil{selectedStaffIds.size > 1 ? 's' : ''} sélectionné{selectedStaffIds.size > 1 ? 's' : ''}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStaffIds(new Set())}
                      disabled={isBulkProcessing}
                      className="landing-chip disabled:opacity-50"
                    >
                      Désélectionner
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkStaffAction('validate')}
                      disabled={isBulkProcessing}
                      className="landing-chip landing-chip--active disabled:opacity-50"
                    >
                      {isBulkProcessing ? 'Traitement…' : 'Valider la sélection'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkStaffAction('reject')}
                      disabled={isBulkProcessing}
                      className="landing-chip border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 disabled:opacity-50"
                    >
                      Refuser la sélection
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkStaffAction('delete')}
                      disabled={isBulkProcessing}
                      className="landing-chip border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 disabled:opacity-50"
                    >
                      Supprimer la sélection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <TablePageSkeleton rows={8} showFilters />
            ) : (
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
          </section>
        </div>
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
