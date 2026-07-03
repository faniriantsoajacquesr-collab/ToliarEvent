interface Transaction {
  id: string;
  date: string;
  title: string;
  description?: string;
  category: string;
  categoryId: string;
  categoryColor: string;
  amount: number;
  type: 'expense' | 'revenue';
}

import { useAuth } from '../contexts/AuthContext';

interface JournalTAccountProps {
  expenses: Transaction[];
  revenues: Transaction[];
  onAddExpense?: () => void;
  onAddRevenue?: () => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (id: string | number) => void;
}

export type { Transaction };
export default function JournalTAccount({ expenses, revenues, onAddExpense, onAddRevenue, onEditTransaction, onDeleteTransaction }: JournalTAccountProps) {
  const { user } = useAuth();
  const isStaffUser = user?.role?.toString().toLowerCase() === 'staff';
  const canModify = !isStaffUser;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden mb-xl">
      <div className="p-lg border-b border-outline-variant flex justify-between items-center">
        <h3 className="text-headline-md font-headline-md text-on-surface">Journal de Caisse</h3>
        <div className="flex gap-md">
          <button className="flex items-center gap-xs px-md py-sm border border-outline rounded-lg text-label-md font-label-md hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-[20px]">filter_list</span>
            Filtrer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 bg-surface-container-low/30 t-account-divider">
        {/* Header Labels */}
        <div className="px-lg py-md border-b border-outline-variant text-center">
          <span className="text-label-md font-label-md font-bold text-error uppercase tracking-widest flex items-center justify-center gap-sm">
            <span className="material-symbols-outlined text-[20px]">trending_down</span>
            Dépenses (Débits)
          </span>
        </div>
        <div className="px-lg py-md border-b border-outline-variant text-center">
          <span className="text-label-md font-label-md font-bold text-green-600 uppercase tracking-widest flex items-center justify-center gap-sm">
            <span className="material-symbols-outlined text-[20px]">trending_up</span>
            Recettes (Crédits)
          </span>
        </div>

        {/* T-Account Entries Container */}
        <div className="col-span-2 grid grid-cols-2 divide-x divide-outline-variant/30 min-h-[400px]">
          {/* Left: Expenses (Column) */}
          <div className="p-md space-y-md flex flex-col">
            {canModify ? (
            <div
              className="h-[88px] flex items-center justify-center border border-dashed border-outline-variant/30 rounded-xl hover:bg-red-50/40 cursor-pointer transition-colors group"
              onClick={onAddExpense}
            >
              <span className="text-error/40 group-hover:text-error transition-colors flex items-center gap-xs text-label-md">
                <span className="material-symbols-outlined">add_circle</span> Ajouter Dépense
              </span>
            </div>
          ) : null}
            {expenses.map((expense) => (
              <div key={expense.id} className="glass-card p-md rounded-xl shadow-sm border-l-4 border-l-error hover:shadow-md transition-all bg-white flex flex-col justify-between min-h-[200px]">
                <div className={canModify ? 'cursor-pointer' : ''} onClick={canModify ? () => onEditTransaction?.(expense) : undefined}>
                  <p className="text-[11px] text-on-surface-variant font-label-md">{expense.date}</p>
                  <p className="text-body-md font-bold font-headline-md text-on-surface">{expense.title}</p>
                  {expense.description ? (
                    <p className="mt-2 text-sm text-on-surface-variant">{expense.description}</p>
                  ) : null}
                  <p className="mt-4 text-body-md font-bold text-error">- {expense.amount.toLocaleString()} Ar</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold ${expense.categoryColor}`}>
                    {expense.category}
                  </span>
                  {canModify ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                        onClick={() => onEditTransaction?.(expense)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-error/10 text-error font-semibold hover:bg-error/20 transition-colors"
                        onClick={() => onDeleteTransaction?.(expense.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Revenues (Column) */}
          <div className="p-md space-y-md flex flex-col">
            {revenues.map((revenue) => (
              <div key={revenue.id} className="glass-card p-md rounded-xl shadow-sm border-r-4 border-r-green-600 hover:shadow-md transition-all bg-white flex flex-col justify-between min-h-[200px]">
                <div className={canModify ? 'cursor-pointer' : ''} onClick={canModify ? () => onEditTransaction?.(revenue) : undefined}>
                  <p className="text-[11px] text-on-surface-variant font-label-md">{revenue.date}</p>
                  <p className="text-body-md font-bold font-headline-md text-on-surface">{revenue.title}</p>
                  {revenue.description ? (
                    <p className="mt-2 text-sm text-on-surface-variant">{revenue.description}</p>
                  ) : null}
                  <p className="mt-4 text-body-md font-bold text-green-600">+ {revenue.amount.toLocaleString()} Ar</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold ${revenue.categoryColor}`}>
                    {revenue.category}
                  </span>
                  {canModify ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                        onClick={() => onEditTransaction?.(revenue)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-error/10 text-error font-semibold hover:bg-error/20 transition-colors"
                        onClick={() => onDeleteTransaction?.(revenue.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {canModify ? (
              <div
                className="h-[88px] flex items-center justify-center border border-dashed border-outline-variant/30 rounded-xl hover:bg-green-50/40 cursor-pointer transition-colors group"
                onClick={onAddRevenue}
              >
                <span className="text-green-600/40 group-hover:text-green-600 transition-colors flex items-center gap-xs text-label-md">
                  <span className="material-symbols-outlined">add_circle</span> Ajouter Recette
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
