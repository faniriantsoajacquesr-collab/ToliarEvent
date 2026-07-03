import { createSupabaseClient } from '../lib/supabase';

export async function updateTaskStatus(
  taskId: string,
  nextStatus: string,
  accessToken: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient(accessToken);

  const { error } = await supabase.rpc('update_task_status_secure', {
    target_task_id: taskId,
    new_status: nextStatus,
  });

  if (error) {
    console.error('Erreur lors de la mise à jour du statut :', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
