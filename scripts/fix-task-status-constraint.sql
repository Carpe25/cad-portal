-- Fix tasks_status_check after adding ready_for_client workflow stage.
-- Run: docker compose exec -T postgres psql -U carpediam -d cad_portal -f - < scripts/fix-task-status-constraint.sql

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (
    status IN (
      'assigned',
      'in_progress',
      'in_qc_review',
      'revision_requested',
      'ready_for_client',
      'client_ready',
      'closed'
    )
  );
