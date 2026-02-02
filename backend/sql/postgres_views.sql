-- Unified read models for PostgreSQL

CREATE OR REPLACE VIEW candidate_applications_view AS
SELECT
  rj.id                    AS resume_job_id,
  rj.resume_id,
  rj.job_id,
  rj.user_id,
  j.company_id,
  rj.status                AS pipeline_status,
  rj.match_score,
  rj.applied_at,
  rj.updated_at,
  r.file_name,
  COALESCE(r.name, (r.parsed_data->>'name'))          AS candidate_name,
  COALESCE(r.email, (r.parsed_data->>'email'))        AS candidate_email,
  COALESCE(r.phone, (r.parsed_data->>'phone'))        AS candidate_phone,
  COALESCE(r.job_title, (r.parsed_data->>'jobTitle')) AS parsed_title,
  r.auto_rejected,
  r.rejection_reason,
  j.title                 AS job_title
FROM resume_jobs rj
JOIN resumes r ON rj.resume_id = r.id
JOIN jobs j    ON rj.job_id    = j.id;

CREATE OR REPLACE VIEW resume_latest_status_view AS
SELECT
  r.id AS resume_id,
  COALESCE((
    SELECT rj.status
    FROM resume_jobs rj
    WHERE rj.resume_id = r.id
    ORDER BY rj.updated_at DESC, rj.applied_at DESC
    LIMIT 1
  ), 'applied') AS derived_status
FROM resumes r;

CREATE OR REPLACE VIEW company_pipeline_view AS
SELECT
  j.company_id,
  rj.job_id,
  j.title AS job_title,
  rj.status,
  COUNT(*) AS candidates_count,
  AVG(COALESCE(rj.match_score, 0)) AS avg_match_score
FROM resume_jobs rj
JOIN jobs j ON j.id = rj.job_id
GROUP BY j.company_id, rj.job_id, j.title, rj.status;

-- Materialized view for dashboard funnel summary
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_pipeline_summary') THEN
    EXECUTE $SQL$
      CREATE MATERIALIZED VIEW mv_pipeline_summary AS
      SELECT
        j.company_id,
        rj.job_id,
        j.title AS job_title,
        SUM(CASE WHEN rj.status = 'applied'   THEN 1 ELSE 0 END) AS applied,
        SUM(CASE WHEN rj.status = 'screening' THEN 1 ELSE 0 END) AS screening,
        SUM(CASE WHEN rj.status = 'interview' THEN 1 ELSE 0 END) AS interview,
        SUM(CASE WHEN rj.status = 'offer'     THEN 1 ELSE 0 END) AS offer,
        SUM(CASE WHEN rj.status = 'hired'     THEN 1 ELSE 0 END) AS hired,
        SUM(CASE WHEN rj.status = 'rejected'  THEN 1 ELSE 0 END) AS rejected
      FROM resume_jobs rj
      JOIN jobs j ON j.id = rj.job_id
      GROUP BY j.company_id, rj.job_id, j.title
    $SQL$;
  END IF;
END$$;
