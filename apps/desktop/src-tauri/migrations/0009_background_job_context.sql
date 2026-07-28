ALTER TABLE background_jobs
ADD COLUMN company_id TEXT;

ALTER TABLE background_jobs
ADD COLUMN branch_id TEXT;

ALTER TABLE background_jobs
ADD COLUMN actor_id TEXT;

ALTER TABLE background_jobs
ADD COLUMN correlation_id TEXT;

CREATE INDEX idx_background_jobs_company_branch
ON background_jobs(company_id, branch_id);

CREATE INDEX idx_background_jobs_correlation
ON background_jobs(correlation_id);
