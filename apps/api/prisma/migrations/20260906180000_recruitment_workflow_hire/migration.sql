-- Job requisition approval (market-standard ATS: draft → approve → open → publish posting)
ALTER TYPE "job_requisition_status" ADD VALUE 'pending_approval';

ALTER TYPE "workflow_entity_type" ADD VALUE 'job_requisition';
