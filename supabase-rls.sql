-- ==============================================================================
-- Supabase Row Level Security (RLS) Setup for JobTracker
-- Table: public.job_applications
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. Create table if not already created
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'Applied',
    ai_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Verify and add user_id column if table was previously created without it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'job_applications' 
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.job_applications 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    END IF;
END $$;

-- 3. Enable and enforce Row Level Security (RLS)
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications FORCE ROW LEVEL SECURITY;

-- 4. Drop any existing policies to prevent conflicts on re-execution
DROP POLICY IF EXISTS "Users can view own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can insert own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can update own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can delete own job applications" ON public.job_applications;

-- 5. Granular RLS Policies

-- Policy A: SELECT - Authenticated users can only read their own records
CREATE POLICY "Users can view own job applications"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
);

-- Policy B: INSERT - Authenticated users can only insert records with their own user_id
CREATE POLICY "Users can insert own job applications"
ON public.job_applications
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) = user_id
);

-- Policy C: UPDATE - Authenticated users can only update their own records
CREATE POLICY "Users can update own job applications"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
)
WITH CHECK (
    (SELECT auth.uid()) = user_id
);

-- Policy D: DELETE - Authenticated users can only delete their own records
CREATE POLICY "Users can delete own job applications"
ON public.job_applications
FOR DELETE
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
);

-- 6. Performance Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id 
ON public.job_applications(user_id);

-- 7. Grant standard CRUD permissions to the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
