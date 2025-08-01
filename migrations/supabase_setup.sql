-- Create the ENUM type for voice_agent_access_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_access_type') THEN
        CREATE TYPE voice_agent_access_type AS ENUM ('support', 'maintainer', 'owner', 'admin');
    END IF;
END $$;

-- Create enum type for appointment_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('pending', 'missed', 'completed', 'cancelled');
    END IF;
END $$;

-- Create enum type for source_training_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_training_status') THEN
        CREATE TYPE public.source_training_status AS ENUM ('pending', 'training', 'done', 'failed', 'retraining', 'retraining_failed', 'unk_err');
    END IF;
END $$;

-- Create enum type for voice_agent_status_enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_status_enum') THEN
        CREATE TYPE public.voice_agent_status_enum AS ENUM ('active', 'inactive', 'suspended', 'deleted');
    END IF;
END $$;

-- Create enum type for function_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'function_type') THEN
        CREATE TYPE public.function_type AS ENUM ('flows', 'json_api', 'form', 'function');
    END IF;
END $$;

-- Create enum type for voice_agent_voice (missing from original migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_voice') THEN
        CREATE TYPE public.voice_agent_voice AS ENUM ('Alloy', 'Ash', 'Ballad', 'Coral', 'Sage', 'Verse');
    END IF;
END $$;

-- Create the customer table with corrected defaults
-- Note: Foreign key to auth.users will be added after ensuring auth schema exists
CREATE TABLE IF NOT EXISTS customer (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL DEFAULT ''::text,
    phone TEXT DEFAULT ''::text,
    company TEXT DEFAULT ''::text,
    title TEXT DEFAULT ''::text,
    plan_id INT NOT NULL,
    stripe_id TEXT UNIQUE,
    source_links_allowed INT DEFAULT 0,
    voiceagents_allowed INT DEFAULT 1,
    total_voiceagents INT DEFAULT 0,
    allowed_msg_credits INT DEFAULT 1000,
    total_credits INT DEFAULT 1000,
    plan_mode TEXT DEFAULT 'free'::text,
    subscription_id TEXT,
    isadmin BOOLEAN DEFAULT FALSE,
    trial BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint to auth.users if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_customer_user' 
            AND table_name = 'customer'
        ) THEN
            ALTER TABLE customer 
            ADD CONSTRAINT fk_customer_user 
            FOREIGN KEY (uuid) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create the voice_agents table with corrected defaults and exact column order
CREATE TABLE IF NOT EXISTS voice_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL,
    last_trained_at TIMESTAMPTZ DEFAULT NULL,
    summary JSONB DEFAULT '{}'::jsonb,
    "takeOverTimeout" TEXT DEFAULT NULL,
    private_settings JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "unAvailable" BOOLEAN DEFAULT FALSE,
    twilio_phone_number TEXT DEFAULT NULL,
    twilio_credentials JSONB DEFAULT '{}'::jsonb,
    transcription_prompt TEXT DEFAULT NULL,
    CONSTRAINT voice_agents_created_by_fkey FOREIGN KEY (created_by) REFERENCES customer(uuid) ON DELETE CASCADE
);

-- Create the voice_agents_access table
CREATE TABLE IF NOT EXISTS voice_agents_access (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voice_agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    access voice_agent_access_type NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES customer(uuid) ON DELETE CASCADE
);

-- Create the business_details table (removed business_timezone default that's not in production)
CREATE TABLE IF NOT EXISTS business_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL UNIQUE,
    business_name TEXT,
    business_phone TEXT,
    type_of_business TEXT,
    additional_context TEXT,
    business_summary TEXT,
    default_appointment_length INTEGER DEFAULT 60,
    operating_schedule JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_timezone TEXT,
    CONSTRAINT business_details_voice_agent_fk FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create the update_last_modified trigger function
CREATE OR REPLACE FUNCTION update_last_modified() 
RETURNS trigger AS $$
BEGIN
    NEW.last_modified := now() AT TIME ZONE 'utc';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the sources table
CREATE TABLE public.sources (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    voice_agent_id uuid NOT NULL,
    name text NOT NULL,
    source_type text NULL,
    size bigint NOT NULL,
    url text NULL,
    auto boolean NOT NULL DEFAULT false,
    auto_sync_interval text NULL DEFAULT 'none'::text,
    auto_sync_last_trained TIMESTAMPTZ NULL,
    last_modified TIMESTAMPTZ NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    status public.source_training_status NULL DEFAULT 'pending'::public.source_training_status,
    CONSTRAINT files_pkey PRIMARY KEY (id),
    CONSTRAINT public_files_voice_agent_id_fkey FOREIGN KEY (voice_agent_id) REFERENCES voice_agents (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create trigger to update last_modified on sources table (corrected timing)
CREATE TRIGGER files_update_last_modified
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION update_last_modified ();

-- Create the scrapping_data table with foreign key for voice_agent_id
CREATE TABLE public.scrapping_data (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data jsonb NULL,
    url text NULL,
    voice_agent_id uuid NULL,
    user_id uuid NULL,
    CONSTRAINT json_objects_pkey PRIMARY KEY (id),
    CONSTRAINT fk_scrapping_data_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_voice_agent_id ON voice_agents_access (voice_agent_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON voice_agents_access (user_id);

-- Enable the pgvector extension if not already enabled
create extension if not exists vector;

-- Function to create embeddings table and associated search function
create or replace function create_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    -- Create the embeddings table if it doesn't exist
    execute format('
        create table if not exists %I (
            id bigserial primary key,
            content text,
            metadata jsonb,
            embedding vector(1536),
            created_at timestamp with time zone default timezone(''utc''::text, now())
        )', table_id);

    -- Create the similarity search function
    execute format('
        create or replace function %I (
            query_embedding vector(1536),
            match_count int default null,
            filter jsonb default ''{}'')
        returns table (
            id bigint,
            content text,
            metadata jsonb,
            similarity float)
        language plpgsql
        security definer
        as $func$
        begin
            return query select
                %I.id,
                %I.content,
                %I.metadata,
                1 - (%I.embedding <=> query_embedding) as similarity
            from %I
            where %I.metadata @> filter
            order by %I.embedding <=> query_embedding
            limit match_count;
        end;
        $func$', 
        table_id || '_search',  -- Function name
        table_id, table_id, table_id, table_id, table_id, table_id, table_id
    );

    -- Create index for similarity search
    execute format('
        create index if not exists %I on %I 
        using ivfflat (embedding vector_cosine_ops) with (lists = 100)',
        table_id || '_embedding_idx',
        table_id
    );
end;
$$;

-- Add function to drop embeddings table and its search function
create or replace function drop_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    -- Drop the search function first
    execute format('drop function if exists %I(vector, int, jsonb)', table_id || '_search');
    
    -- Drop the table
    execute format('drop table if exists %I', table_id);
end;
$$;

-- Function to create tables when a new voice agent is created
create or replace function create_voice_agent_tables()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Create embeddings table for the new voice agent
    perform create_embeddings_table('zz_' || new.id);
    return new;
end;
$$;

-- Create trigger for automatic table creation on voice_agents
drop trigger if exists voice_agent_table_create on voice_agents;
create trigger voice_agent_table_create
    after insert on voice_agents
    for each row
    execute function create_voice_agent_tables();

-- Function to notify realtime channel on changes
CREATE OR REPLACE FUNCTION notify_realtime_change() 
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(OLD));
  END IF;
  PERFORM pg_notify('realtime_changes', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for voice_agents table (corrected timing and events)
DROP TRIGGER IF EXISTS realtime_voice_agents_trigger ON voice_agents;
CREATE TRIGGER realtime_voice_agents_trigger
AFTER INSERT OR UPDATE OR DELETE ON voice_agents
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Trigger for business_details table (corrected timing and events)
DROP TRIGGER IF EXISTS realtime_business_details_trigger ON business_details;
CREATE TRIGGER realtime_business_details_trigger
AFTER INSERT OR UPDATE OR DELETE ON business_details
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Create the functions table for storing function details
CREATE TABLE public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.function_type NULL,
  data jsonb NULL,
  created_by uuid NULL,
  assistant_id uuid NULL,
  is_active boolean NULL DEFAULT true,
  name text NULL,
  purpose text NULL,
  trigger_reason text NULL,
  variables jsonb NULL,
  save_data boolean NULL DEFAULT false,
  is_shownable boolean NULL,
  CONSTRAINT functions_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_functions_created_by
  ON public.functions USING btree (created_by) TABLESPACE pg_default;

-- Add foreign key constraint to auth.users for functions table if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'functions_created_by_fkey' 
            AND table_name = 'functions'
        ) THEN
            ALTER TABLE functions 
            ADD CONSTRAINT functions_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Create the call_logs table with summary fields included
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    call_start TIMESTAMPTZ NOT NULL,
    call_end TIMESTAMPTZ,
    caller_number TEXT,
    transcript TEXT,
    duration TEXT,
    status TEXT,
    summary JSONB,
    summary_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id)
        REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create the appointments table with corrected phone_number default
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL DEFAULT 'Not Provided'::text,
    service TEXT NOT NULL,
    special_notes TEXT DEFAULT NULL,
    schedule_time TIMESTAMPTZ NOT NULL,
    status appointment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT fk_appointments_voice_agents FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Corrected trigger timing for appointments
CREATE TRIGGER update_appointment_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_timestamp();
-- Create the ENUM type for voice_agent_access_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_access_type') THEN
        CREATE TYPE voice_agent_access_type AS ENUM ('support', 'maintainer', 'owner', 'admin');
    END IF;
END $$;

-- Create enum type for appointment_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('pending', 'missed', 'completed', 'cancelled');
    END IF;
END $$;

-- Create enum type for source_training_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_training_status') THEN
        CREATE TYPE public.source_training_status AS ENUM ('pending', 'training', 'done', 'failed', 'retraining', 'retraining_failed', 'unk_err');
    END IF;
END $$;

-- Create enum type for voice_agent_status_enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_status_enum') THEN
        CREATE TYPE public.voice_agent_status_enum AS ENUM ('active', 'inactive', 'suspended', 'deleted');
    END IF;
END $$;

-- Create enum type for function_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'function_type') THEN
        CREATE TYPE public.function_type AS ENUM ('flows', 'json_api', 'form', 'function');
    END IF;
END $$;

-- Create enum type for voice_agent_voice (missing from original migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_voice') THEN
        CREATE TYPE public.voice_agent_voice AS ENUM ('Alloy', 'Ash', 'Ballad', 'Coral', 'Sage', 'Verse');
    END IF;
END $$;

-- Create the customer table with corrected defaults
-- Note: Foreign key to auth.users will be added after ensuring auth schema exists
CREATE TABLE IF NOT EXISTS customer (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL DEFAULT ''::text,
    phone TEXT DEFAULT ''::text,
    company TEXT DEFAULT ''::text,
    title TEXT DEFAULT ''::text,
    plan_id INT NOT NULL,
    stripe_id TEXT UNIQUE,
    source_links_allowed INT DEFAULT 0,
    voiceagents_allowed INT DEFAULT 1,
    total_voiceagents INT DEFAULT 0,
    allowed_msg_credits INT DEFAULT 1000,
    total_credits INT DEFAULT 1000,
    plan_mode TEXT DEFAULT 'free'::text,
    subscription_id TEXT,
    isadmin BOOLEAN DEFAULT FALSE,
    trial BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint to auth.users if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_customer_user' 
            AND table_name = 'customer'
        ) THEN
            ALTER TABLE customer 
            ADD CONSTRAINT fk_customer_user 
            FOREIGN KEY (uuid) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create the voice_agents table with corrected defaults and exact column order
CREATE TABLE IF NOT EXISTS voice_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL,
    last_trained_at TIMESTAMPTZ DEFAULT NULL,
    summary JSONB DEFAULT '{}'::jsonb,
    "takeOverTimeout" TEXT DEFAULT NULL,
    private_settings JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "unAvailable" BOOLEAN DEFAULT FALSE,
    twilio_phone_number TEXT DEFAULT NULL,
    twilio_credentials JSONB DEFAULT '{}'::jsonb,
    transcription_prompt TEXT DEFAULT NULL,
    CONSTRAINT voice_agents_created_by_fkey FOREIGN KEY (created_by) REFERENCES customer(uuid) ON DELETE CASCADE
);

-- Create the voice_agents_access table
CREATE TABLE IF NOT EXISTS voice_agents_access (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voice_agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    access voice_agent_access_type NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES customer(uuid) ON DELETE CASCADE
);

-- Create the business_details table (removed business_timezone default that's not in production)
CREATE TABLE IF NOT EXISTS business_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL UNIQUE,
    business_name TEXT,
    business_phone TEXT,
    type_of_business TEXT,
    additional_context TEXT,
    business_summary TEXT,
    default_appointment_length INTEGER DEFAULT 60,
    operating_schedule JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_timezone TEXT,
    CONSTRAINT business_details_voice_agent_fk FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create the update_last_modified trigger function
CREATE OR REPLACE FUNCTION update_last_modified() 
RETURNS trigger AS $$
BEGIN
    NEW.last_modified := now() AT TIME ZONE 'utc';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the sources table
CREATE TABLE public.sources (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    voice_agent_id uuid NOT NULL,
    name text NOT NULL,
    source_type text NULL,
    size bigint NOT NULL,
    url text NULL,
    auto boolean NOT NULL DEFAULT false,
    auto_sync_interval text NULL DEFAULT 'none'::text,
    auto_sync_last_trained TIMESTAMPTZ NULL,
    last_modified TIMESTAMPTZ NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    status public.source_training_status NULL DEFAULT 'pending'::public.source_training_status,
    CONSTRAINT files_pkey PRIMARY KEY (id),
    CONSTRAINT public_files_voice_agent_id_fkey FOREIGN KEY (voice_agent_id) REFERENCES voice_agents (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create trigger to update last_modified on sources table (corrected timing)
CREATE TRIGGER files_update_last_modified
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION update_last_modified ();

-- Create the scrapping_data table with foreign key for voice_agent_id
CREATE TABLE public.scrapping_data (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data jsonb NULL,
    url text NULL,
    voice_agent_id uuid NULL,
    user_id uuid NULL,
    CONSTRAINT json_objects_pkey PRIMARY KEY (id),
    CONSTRAINT fk_scrapping_data_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_voice_agent_id ON voice_agents_access (voice_agent_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON voice_agents_access (user_id);

-- Enable the pgvector extension if not already enabled
create extension if not exists vector;

-- Function to create embeddings table and associated search function
create or replace function create_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    -- Create the embeddings table if it doesn't exist
    execute format('
        create table if not exists %I (
            id bigserial primary key,
            content text,
            metadata jsonb,
            embedding vector(1536),
            created_at timestamp with time zone default timezone(''utc''::text, now())
        )', table_id);

    -- Create the similarity search function
    execute format('
        create or replace function %I (
            query_embedding vector(1536),
            match_count int default null,
            filter jsonb default ''{}'')
        returns table (
            id bigint,
            content text,
            metadata jsonb,
            similarity float)
        language plpgsql
        security definer
        as $func$
        begin
            return query select
                %I.id,
                %I.content,
                %I.metadata,
                1 - (%I.embedding <=> query_embedding) as similarity
            from %I
            where %I.metadata @> filter
            order by %I.embedding <=> query_embedding
            limit match_count;
        end;
        $func$', 
        table_id || '_search',  -- Function name
        table_id, table_id, table_id, table_id, table_id, table_id, table_id
    );

    -- Create index for similarity search
    execute format('
        create index if not exists %I on %I 
        using ivfflat (embedding vector_cosine_ops) with (lists = 100)',
        table_id || '_embedding_idx',
        table_id
    );
end;
$$;

-- Add function to drop embeddings table and its search function
create or replace function drop_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    -- Drop the search function first
    execute format('drop function if exists %I(vector, int, jsonb)', table_id || '_search');
    
    -- Drop the table
    execute format('drop table if exists %I', table_id);
end;
$$;

-- Function to create tables when a new voice agent is created
create or replace function create_voice_agent_tables()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Create embeddings table for the new voice agent
    perform create_embeddings_table('zz_' || new.id);
    return new;
end;
$$;

-- Create trigger for automatic table creation on voice_agents
drop trigger if exists voice_agent_table_create on voice_agents;
create trigger voice_agent_table_create
    after insert on voice_agents
    for each row
    execute function create_voice_agent_tables();

-- Function to notify realtime channel on changes
CREATE OR REPLACE FUNCTION notify_realtime_change() 
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(OLD));
  END IF;
  PERFORM pg_notify('realtime_changes', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for voice_agents table (corrected timing and events)
DROP TRIGGER IF EXISTS realtime_voice_agents_trigger ON voice_agents;
CREATE TRIGGER realtime_voice_agents_trigger
AFTER INSERT OR UPDATE OR DELETE ON voice_agents
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Trigger for business_details table (corrected timing and events)
DROP TRIGGER IF EXISTS realtime_business_details_trigger ON business_details;
CREATE TRIGGER realtime_business_details_trigger
AFTER INSERT OR UPDATE OR DELETE ON business_details
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Create the functions table for storing function details
CREATE TABLE public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.function_type NULL,
  data jsonb NULL,
  created_by uuid NULL,
  assistant_id uuid NULL,
  is_active boolean NULL DEFAULT true,
  name text NULL,
  purpose text NULL,
  trigger_reason text NULL,
  variables jsonb NULL,
  save_data boolean NULL DEFAULT false,
  is_shownable boolean NULL,
  CONSTRAINT functions_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_functions_created_by
  ON public.functions USING btree (created_by) TABLESPACE pg_default;

-- Add foreign key constraint to auth.users for functions table if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'functions_created_by_fkey' 
            AND table_name = 'functions'
        ) THEN
            ALTER TABLE functions 
            ADD CONSTRAINT functions_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Create the call_logs table with summary fields included
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    call_start TIMESTAMPTZ NOT NULL,
    call_end TIMESTAMPTZ,
    caller_number TEXT,
    transcript TEXT,
    duration TEXT,
    status TEXT,
    summary JSONB,
    summary_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id)
        REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create the appointments table with corrected phone_number default
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL DEFAULT 'Not Provided'::text,
    service TEXT NOT NULL,
    special_notes TEXT DEFAULT NULL,
    schedule_time TIMESTAMPTZ NOT NULL,
    status appointment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT fk_appointments_voice_agents FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Corrected trigger timing for appointments
CREATE TRIGGER update_appointment_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_timestamp();
-- Create the ENUM type for voice_agent_access_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_access_type') THEN
        CREATE TYPE voice_agent_access_type AS ENUM ('support', 'maintainer', 'owner', 'admin');
    END IF;
END $$;

-- Create enum type for appointment_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('pending', 'missed', 'completed', 'cancelled');
    END IF;
END $$;

-- Create enum type for source_training_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_training_status') THEN
        CREATE TYPE public.source_training_status AS ENUM ('pending', 'training', 'done', 'failed', 'retraining', 'retraining_failed', 'unk_err');
    END IF;
END $$;

-- Create enum type for voice_agent_status_enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_status_enum') THEN
        CREATE TYPE public.voice_agent_status_enum AS ENUM ('active', 'inactive', 'suspended', 'deleted');
    END IF;
END $$;

-- Create enum type for function_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'function_type') THEN
        CREATE TYPE public.function_type AS ENUM ('flows', 'json_api', 'form', 'function');
    END IF;
END $$;

-- Create enum type for voice_agent_voice (missing from original migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_voice') THEN
        CREATE TYPE public.voice_agent_voice AS ENUM ('Alloy', 'Ash', 'Ballad', 'Coral', 'Sage', 'Verse');
    END IF;
END $$;

-- Create the customer table with corrected defaults
-- Note: Foreign key to auth.users will be added after ensuring auth schema exists
CREATE TABLE IF NOT EXISTS customer (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL DEFAULT ''::text,
    phone TEXT DEFAULT ''::text,
    company TEXT DEFAULT ''::text,
    title TEXT DEFAULT ''::text,
    plan_id INT NOT NULL,
    stripe_id TEXT UNIQUE,
    source_links_allowed INT DEFAULT 0,
    voiceagents_allowed INT DEFAULT 1,
    total_voiceagents INT DEFAULT 0,
    allowed_msg_credits INT DEFAULT 1000,
    total_credits INT DEFAULT 1000,
    plan_mode TEXT DEFAULT 'free'::text,
    subscription_id TEXT,
    isadmin BOOLEAN DEFAULT FALSE,
    trial BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint to auth.users if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_customer_user' 
            AND table_name = 'customer'
        ) THEN
            ALTER TABLE customer 
            ADD CONSTRAINT fk_customer_user 
            FOREIGN KEY (uuid) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create the voice_agents table with corrected defaults and exact column order
CREATE TABLE IF NOT EXISTS voice_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL,
    last_trained_at TIMESTAMPTZ DEFAULT NULL,
    summary JSONB DEFAULT '{}'::jsonb,
    "takeOverTimeout" TEXT DEFAULT NULL,
    private_settings JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "unAvailable" BOOLEAN DEFAULT FALSE,
    twilio_phone_number TEXT DEFAULT NULL,
    twilio_credentials JSONB DEFAULT '{}'::jsonb,
    transcription_prompt TEXT DEFAULT NULL,
    CONSTRAINT voice_agents_created_by_fkey FOREIGN KEY (created_by) REFERENCES customer(uuid) ON DELETE CASCADE
);

-- Create the voice_agents_access table
CREATE TABLE IF NOT EXISTS voice_agents_access (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voice_agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    access voice_agent_access_type NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES customer(uuid) ON DELETE CASCADE
);

-- Create the business_details table (removed business_timezone default that's not in production)
CREATE TABLE IF NOT EXISTS business_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL UNIQUE,
    business_name TEXT,
    business_phone TEXT,
    type_of_business TEXT,
    additional_context TEXT,
    business_summary TEXT,
    default_appointment_length INTEGER DEFAULT 60,
    operating_schedule JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_timezone TEXT,
    CONSTRAINT business_details_voice_agent_fk FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create the update_last_modified trigger function
CREATE OR REPLACE FUNCTION update_last_modified() 
RETURNS trigger AS $$
BEGIN
    NEW.last_modified := now() AT TIME ZONE 'utc';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the sources table
CREATE TABLE public.sources (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    voice_agent_id uuid NOT NULL,
    name text NOT NULL,
    source_type text NULL,
    size bigint NOT NULL,
    url text NULL,
    auto boolean NOT NULL DEFAULT false,
    auto_sync_interval text NULL DEFAULT 'none'::text,
    auto_sync_last_trained TIMESTAMPTZ NULL,
    last_modified TIMESTAMPTZ NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    status public.source_training_status NULL DEFAULT 'pending'::public.source_training_status,
    CONSTRAINT files_pkey PRIMARY KEY (id),
    CONSTRAINT public_files_voice_agent_id_fkey FOREIGN KEY (voice_agent_id) REFERENCES voice_agents (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create trigger to update last_modified on sources table (corrected timing)
CREATE TRIGGER files_update_last_modified
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION update_last_modified ();

-- Create the scrapping_data table with foreign key for voice_agent_id
CREATE TABLE public.scrapping_data (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data jsonb NULL,
    url text NULL,
    voice_agent_id uuid NULL,
    user_id uuid NULL,
    CONSTRAINT json_objects_pkey PRIMARY KEY (id),
    CONSTRAINT fk_scrapping_data_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_voice_agent_id ON voice_agents_access (voice_agent_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON voice_agents_access (user_id);

-- Enable the pgvector extension if not already enabled
create extension if not exists vector;

-- Function to create embeddings table and associated search function
create or replace function create_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    -- Create the embeddings table if it doesn't exist
    execute format('
        create table if not exists %I (
            id bigserial primary key,
            content text,
            metadata jsonb,
            embedding vector(1536),
            created_at timestamp with time zone default timezone(''utc''::text, now())
        )', table_id);

    -- Create the similarity search function
    execute format('
        create or replace function %I (
            query_embedding vector(1536),
            match_count int default null,
            filter jsonb default ''{}'')
        returns table (
            id bigint,
            content text,
            metadata jsonb,
            similarity float)
        language plpgsql
        security definer
        as $func$
        begin
            return query select
                %I.id,
                %I.content,
                %I.metadata,
                1 - (%I.embedding <=> query_embedding) as similarity
            from %I
            where %I.metadata @> filter
            order by %I.embedding <=> query_embedding
            limit match_count;
        end;
        $func$', 
        table_id || '_search',  -- Function name
        table_id, table_id, table_id, table_id, table_id, table_id, table_id
    );

    -- Create index for similarity search
    execute format('
        create index if not exists %I on %I 
        using ivfflat (embedding vector_cosine_ops) with (lists = 100)',
        table_id || '_embedding_idx',
        table_id
    );
end;
$$;

-- Add function to drop embeddings table and its search function
create or replace function drop_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    -- Drop the search function first
    execute format('drop function if exists %I(vector, int, jsonb)', table_id || '_search');
    
    -- Drop the table
    execute format('drop table if exists %I', table_id);
end;
$$;

-- Function to create tables when a new voice agent is created
create or replace function create_voice_agent_tables()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Create embeddings table for the new voice agent
    perform create_embeddings_table('zz_' || new.id);
    return new;
end;
$$;

-- Create trigger for automatic table creation on voice_agents
drop trigger if exists voice_agent_table_create on voice_agents;
create trigger voice_agent_table_create
    after insert on voice_agents
    for each row
    execute function create_voice_agent_tables();

-- Function to notify realtime channel on changes
CREATE OR REPLACE FUNCTION notify_realtime_change() 
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    payload = json_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'data', row_to_json(OLD));
  END IF;
  PERFORM pg_notify('realtime_changes', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for voice_agents table (corrected timing and events)
DROP TRIGGER IF EXISTS realtime_voice_agents_trigger ON voice_agents;
CREATE TRIGGER realtime_voice_agents_trigger
AFTER INSERT OR UPDATE OR DELETE ON voice_agents
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Trigger for business_details table (corrected timing and events)
DROP TRIGGER IF EXISTS realtime_business_details_trigger ON business_details;
CREATE TRIGGER realtime_business_details_trigger
AFTER INSERT OR UPDATE OR DELETE ON business_details
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Create the functions table for storing function details
CREATE TABLE public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.function_type NULL,
  data jsonb NULL,
  created_by uuid NULL,
  assistant_id uuid NULL,
  is_active boolean NULL DEFAULT true,
  name text NULL,
  purpose text NULL,
  trigger_reason text NULL,
  variables jsonb NULL,
  save_data boolean NULL DEFAULT false,
  is_shownable boolean NULL,
  CONSTRAINT functions_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_functions_created_by
  ON public.functions USING btree (created_by) TABLESPACE pg_default;

-- Add foreign key constraint to auth.users for functions table if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'functions_created_by_fkey' 
            AND table_name = 'functions'
        ) THEN
            ALTER TABLE functions 
            ADD CONSTRAINT functions_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Create the call_logs table with summary fields included
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    call_start TIMESTAMPTZ NOT NULL,
    call_end TIMESTAMPTZ,
    caller_number TEXT,
    transcript TEXT,
    duration TEXT,
    status TEXT,
    summary JSONB,
    summary_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id)
        REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create the appointments table with corrected phone_number default
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL DEFAULT 'Not Provided'::text,
    service TEXT NOT NULL,
    special_notes TEXT DEFAULT NULL,
    schedule_time TIMESTAMPTZ NOT NULL,
    status appointment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT fk_appointments_voice_agents FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Corrected trigger timing for appointments
CREATE TRIGGER update_appointment_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_timestamp();
