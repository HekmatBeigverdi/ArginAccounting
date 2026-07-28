CREATE TABLE background_jobs (
    job_id              TEXT PRIMARY KEY NOT NULL,
    job_type            TEXT NOT NULL,
    payload_json        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (
                            status IN (
                                'pending',
                                'running',
                                'completed',
                                'failed'
                            )
                        ),
    attempt_count       INTEGER NOT NULL DEFAULT 0
                        CHECK (attempt_count >= 0),
    maximum_attempts    INTEGER NOT NULL DEFAULT 3
                        CHECK (
                            maximum_attempts >= 1
                            AND maximum_attempts <= 100
                        ),
    scheduled_at        TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    started_at          TEXT,
    completed_at        TEXT,
    last_error          TEXT,
    CHECK (json_valid(payload_json))
);

CREATE INDEX idx_background_jobs_ready
ON background_jobs(
    status,
    scheduled_at,
    created_at
);

CREATE INDEX idx_background_jobs_type
ON background_jobs(job_type);

CREATE INDEX idx_background_jobs_completed
ON background_jobs(
    status,
    completed_at
);
