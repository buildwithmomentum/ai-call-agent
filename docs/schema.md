# Voice Agents Database Schema

## Table of Contents
- [Overview](#overview)
- [How to Use This Schema](#how-to-use-this-schema)
- [Customer Table](#customer-table)
- [Voice Agents Table](#voice-agents-table)
- [ENUM Type: Access Roles](#enum-type-access-roles)
- [ENUM Type: Source Training Status](#enum-type-source-training-status)
- [ENUM Type: Voice Agent Status](#enum-type-voice-agent-status)
- [ENUM Type: Function Type](#enum-type-function-type)
- [Voice Agents Access Table](#voice-agents-access-table)
- [Indexes for Optimization](#indexes-for-optimization)
- [Business Details Table](#business-details-table)
- [Sources Table](#sources-table)
- [Scrapping Data Table](#scrapping-data-table)
- [Realtime Triggers for Voice Agents and Business Details](#realtime-triggers-for-voice-agents-and-business-details)
- [Additional Functions & Triggers](#additional-functions--triggers)
- [Extensions](#extensions)
- [Functions Table](#functions-table)
- [Call Logs Table](#call-logs-table)
- [Appointments Table](#appointments-table)

## Overview
This document provides the SQL schema for managing **customers, voice agents, and their access control** in a PostgreSQL (Supabase) database.

## How to Use This Schema
1. **Copy & paste** the SQL statements below into your Supabase SQL Editor or run them via `psql`.
2. Ensure the `auth.users` table exists before executing the queries.
3. Alternatively, run the full `supabase_setup.sql` file (located in `migrations/`) to automatically set up all tables, functions, triggers, realtime notifications, and extensions.
4. Run additional queries to test and validate relationships.

✅ Now, your database is ready to manage **customers, voice agents, and their access control** efficiently! 🚀

---

### **📋 Tables Included:**
1. `customer` → Stores user info (linked to `auth.users`)
2. `voice_agents` → Stores voice agent details (linked to `customer`)
3. `voice_agents_access` → Manages user access roles for voice agents
4. `business_details` → Stores business details linked to voice agents
5. `sources` → Stores file sources linked to a voice agent
6. `scrapping_data` → Stores additional JSON data with optional links to voice agents and users

---

## Customer Table
Stores customer details and links to `auth.users`.

```sql
CREATE TABLE IF NOT EXISTS customer (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Same as auth.users.id
    email TEXT UNIQUE NOT NULL,  -- Same as auth.users.email
    username TEXT NOT NULL,       -- new column for username
    phone TEXT,                   -- new column for phone number
    company TEXT,                 -- new column for company/organization/business name
    title TEXT,                   -- new column for title/profession
    plan_id INT NOT NULL,
    stripe_id TEXT,
    source_links_allowed INT DEFAULT 0,
    voiceagents_allowed INT DEFAULT 0,
    total_voiceagents INT DEFAULT 0,
    allowed_msg_credits INT DEFAULT 0,
    total_credits INT DEFAULT 0,
    plan_mode TEXT,
    subscription_id TEXT,
    isadmin BOOLEAN DEFAULT FALSE,
    trial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_auth_users FOREIGN KEY (uuid) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_auth_users_email FOREIGN KEY (email) REFERENCES auth.users(email) ON DELETE CASCADE
);
```

**🔗 Foreign Key Relationships:**
- `customer.uuid` ↔ `auth.users.id`
- `customer.email` ↔ `auth.users.email`

---

## Voice Agents Table
Stores AI-powered voice agents linked to a customer.

```sql
CREATE TABLE IF NOT EXISTS voice_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL,  -- Same as customer.uuid
    last_trained_at TIMESTAMPTZ DEFAULT NULL,
    summary JSONB DEFAULT '{}',
    "takeOverTimeout" TEXT DEFAULT NULL,
    "unAvailable" BOOLEAN DEFAULT FALSE,  -- new field indicating if the voice agent is unavailable
    private_settings JSONB DEFAULT '{}',
    twilio_phone_number TEXT DEFAULT NULL,  -- Stores the Twilio phone number assigned to this voice agent
    twilio_credentials JSONB DEFAULT '{}',  -- Stores Twilio account credentials for this voice agent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES customer(uuid) ON DELETE CASCADE
);
```

**🔗 Foreign Key Relationships:**
- `voice_agents.created_by` ↔ `customer.uuid`

**📱 Phone Number Format:**
- `twilio_phone_number` should be stored in E.164 format without spaces (e.g., `+19895644594`)
- This format ensures consistent phone number handling and simplifies matching in the application
- While the system can handle phone numbers with spaces (e.g., `+1 989 564 4594`), storing them without spaces is recommended for optimal performance

**🔐 Twilio Credentials Format:**
- `twilio_credentials` stores Twilio account credentials in JSONB format:
```json
{
  "account_sid": "ACd12******",
  "auth_token": "4*****"
}
```
- This allows each voice agent to have its own Twilio credentials if needed
- If not set, the system falls back to the global Twilio credentials from environment variables

---

## ENUM Type: Access Roles
Defines the types of access a user can have to a voice agent.

```sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_access_type') THEN
        CREATE TYPE voice_agent_access_type AS ENUM ('support', 'maintainer', 'owner', 'admin');
    END IF;
END $$;
```

## ENUM Type: Source Training Status
Defines the training status for file sources.
```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_training_status') THEN
        CREATE TYPE public.source_training_status AS ENUM ('pending', 'training', 'done', 'failed', 'retraining', 'retraining_failed', 'unk_err');
    END IF;
END $$;
```

## ENUM Type: Voice Agent Status
Defines the status for voice agents.
```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_agent_status_enum') THEN
        CREATE TYPE public.voice_agent_status_enum AS ENUM ('active', 'inactive', 'suspended', 'deleted');
    END IF;
END $$;
```

## ENUM Type: Function Type
Defines the types of functions.

```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'function_type') THEN
        CREATE TYPE public.function_type AS ENUM ('flows', 'json_api', 'form', 'function');
    END IF;
END $$;
```

## Voice Agents Access Table
Manages access control for voice agents.

```sql
CREATE TABLE IF NOT EXISTS voice_agents_access (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voice_agent_id UUID NOT NULL,  -- Same as voice_agents.id
    user_id UUID NOT NULL,  -- Same as customer.uuid
    access voice_agent_access_type NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES customer(uuid) ON DELETE CASCADE
);
```

**🔗 Foreign Key Relationships:**
- `voice_agents_access.voice_agent_id` ↔ `voice_agents.id`
- `voice_agents_access.user_id` ↔ `customer.uuid`

---

## Indexes for Optimization

```sql
CREATE INDEX IF NOT EXISTS idx_voice_agent_id ON voice_agents_access (voice_agent_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON voice_agents_access (user_id);
```

---

## Business Details Table
This table links business details with a corresponding voice agent. Each business must be linked to one voice agent, and each voice agent can have only one business. When a voice agent is deleted, its related business is removed.

```sql
CREATE TABLE public.business_details (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  voice_agent_id uuid NOT NULL,  -- updated to be required
  business_name text,
  business_phone text,
  type_of_business text,
  additional_context text,
  business_summary text,  -- new column for business summary
  default_appointment_length INTEGER DEFAULT 60,  -- default appointment duration in minutes
  operating_schedule jsonb, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  business_timezone TEXT,  -- stores the business's timezone
  CONSTRAINT business_details_pkey PRIMARY KEY (id),
  CONSTRAINT business_details_voice_agent_fk FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE, 
  CONSTRAINT unique_voice_agent_business UNIQUE (voice_agent_id)  -- ensures one-to-one relationship
) TABLESPACE pg_default;
```


The update adds the `business_timezone TEXT` field to the SQL table definition in the documentation, with a comment explaining its purpose. This ensures the documentation matches the actual database schema that already includes this column.
---

## Sources Table
Stores file sources linked to a voice agent.

```sql
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
    status public.source_training_status NULL DEFAULT 'pending'::source_training_status,
    CONSTRAINT files_pkey PRIMARY KEY (id),
    CONSTRAINT public_files_voice_agent_id_fkey FOREIGN KEY (voice_agent_id) REFERENCES voice_agents (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TRIGGER files_update_last_modified
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION update_last_modified ();
```

---

## Scrapping Data Table
Stores additional JSON data with optional links to voice agents and users.  
Note: voice_agent_id is a foreign key referencing voice_agents(id).

```sql
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
```

---

## Realtime Triggers for Voice Agents and Business Details

The following SQL snippet sets up realtime notifications for changes in the `voice_agents` and `business_details` tables using PostgreSQL's NOTIFY mechanism.

```sql
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

-- Trigger for voice_agents table
DROP TRIGGER IF EXISTS realtime_voice_agents_trigger ON voice_agents;
CREATE TRIGGER realtime_voice_agents_trigger
AFTER INSERT OR UPDATE OR DELETE ON voice_agents
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();

-- Trigger for business_details table
DROP TRIGGER IF EXISTS realtime_business_details_trigger ON business_details;
CREATE TRIGGER realtime_business_details_trigger
AFTER INSERT OR UPDATE OR DELETE ON business_details
FOR EACH ROW EXECUTE FUNCTION notify_realtime_change();
```

## Additional Functions & Triggers

### Update_Last_Modified Trigger on Sources Table
This trigger automatically updates the `last_modified` timestamp for rows in the `sources` table upon update.

```sql
CREATE OR REPLACE FUNCTION update_last_modified() 
RETURNS trigger AS $$
BEGIN
    NEW.last_modified := now() AT TIME ZONE 'utc';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER files_update_last_modified
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION update_last_modified ();
```

### Embedding Tables Management Functions

#### Create Embeddings Table Function
The function `create_embeddings_table` creates an embeddings table for a voice agent and its associated search function.

```sql
create or replace function create_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    execute format('
        create table if not exists %I (
            id bigserial primary key,
            content text,
            metadata jsonb,
            embedding vector(1536),
            created_at timestamp with time zone default timezone(''utc''::text, now())
        )', table_id);

    execute format('
        create or replace function %I (
            query_embedding vector(1536),
            match_count int default null,
            filter jsonb default ''{}''
        )
        returns table (
            id bigint,
            content text,
            metadata jsonb,
            similarity float
        )
        language plpgsql
        security definer
        as $func$
        begin
            return query 
            select %I.id, %I.content, %I.metadata, 1 - (%I.embedding <=> query_embedding) as similarity
            from %I
            where %I.metadata @> filter
            order by %I.embedding <=> query_embedding
            limit match_count;
        end;
        $func$', 
        table_id || '_search',  table_id, table_id, table_id, table_id, table_id, table_id, table_id
    );

    execute format('
        create index if not exists %I on %I 
        using ivfflat (embedding vector_cosine_ops) with (lists = 100)', 
        table_id || '_embedding_idx', 
        table_id
    );
end;
$$;
```

#### Drop Embeddings Table Function
The function `drop_embeddings_table` safely removes an embeddings table and its associated search function. This is primarily used during voice agent deletion to clean up related database objects.

```sql
create or replace function drop_embeddings_table(table_id text)
returns void
language plpgsql
security definer
as $$
begin
    execute format('drop table if exists %I', table_id);
    execute format('drop function if exists %I', table_id || '_search');
end;
$$;
```

-- Trigger for automatic embeddings table creation when a new voice agent is added
create or replace function create_voice_agent_tables()
returns trigger
language plpgsql
security definer
as $$
begin
    perform create_embeddings_table('zz_' || new.id);
    return new;
end;
$$;

drop trigger if exists voice_agent_table_create on voice_agents;
create trigger voice_agent_table_create
    after insert on voice_agents
    for each row
    execute function create_voice_agent_tables();
```

## Extensions

### pgvector Extension
The pgvector extension is enabled to support vector operations in embedding tables.

```sql
create extension if not exists vector;
```

## Functions Table

Stores details of functions with:
- assistant_id representing the voice_agent_id
- created_by referencing the customer's id (auth.users.id)

```sql
CREATE TABLE public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.function_type NULL,
  data jsonb NULL,
  created_by uuid NULL, -- maps to customer's id (auth.users.id)
  assistant_id uuid NULL, -- maps to voice_agent_id
  is_active boolean NULL DEFAULT true,
  name text NULL,
  purpose text NULL,
  trigger_reason text NULL,
  variables jsonb NULL,
  save_data boolean NULL DEFAULT false,
  is_shownable boolean NULL,
  CONSTRAINT functions_pkey PRIMARY KEY (id),
  CONSTRAINT functions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_functions_created_by
  ON public.functions USING btree (created_by) TABLESPACE pg_default;
```

## Call Logs Table

The `call_logs` table records details of calls made by voice agents, including conversation summaries and analysis.
Call duration is calculated in the application code.

```sql
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    call_start TIMESTAMPTZ NOT NULL,
    call_end TIMESTAMPTZ, -- Can be NULL until the call ends
    caller_number TEXT,   -- The phone number of the caller (provided by Twilio in E.164 format)
    transcript TEXT,
    duration INTERVAL,   -- Calculated from call_start to call_end in app code
    status TEXT,         -- e.g., 'completed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    summary JSONB,       -- New field for conversation 
    metadata JSONB,      -- New field for additional 
    CONSTRAINT fk_voice_agent FOREIGN KEY (voice_agent_id)
        REFERENCES voice_agents(id) ON DELETE CASCADE
);
```

**Note about `caller_number`:**
- Field is automatically populated by Twilio during call events
- Stored in E.164 format (e.g., +19895644594)
- Required for callback functionality and call tracking

## Appointments Table
Manages appointment scheduling and tracking.

### ENUM Type: `appointment_status`
Defines the possible states of an appointment:
- `pending` - Default status for new appointments
- `missed` - When an appointment was not attended
- `completed` - When an appointment has been successfully completed
- `cancelled` - When an appointment has been cancelled

```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('pending', 'missed', 'completed', 'cancelled');
    END IF;
END $$;
```

### Appointments Table Schema
```sql
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_agent_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    service TEXT NOT NULL,
    special_notes TEXT DEFAULT NULL,
    schedule_time TIMESTAMPTZ NOT NULL,
    status appointment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT fk_appointments_voice_agents FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE CASCADE
);
```

**Columns:**
- `id`: Unique identifier for the appointment
- `voice_agent_id`: References the voice agent handling the appointment
- `name`: Name of the person booking appointment
- `phone_number`: Contact phone number
- `service`: Type of service requested
- `special_notes`: Additional instructions or notes (optional)
- `schedule_time`: Date and time of the appointment
- `status`: Current status of the appointment (pending/missed/completed/cancelled)
- `created_at`: Timestamp when appointment was created
- `updated_at`: Timestamp of last update (null if never updated)

### Automatic Update Timestamp
A trigger automatically updates the `updated_at` timestamp whenever an appointment record is modified:

```sql
CREATE OR REPLACE FUNCTION update_appointment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointment_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_timestamp();
```

**Key Features:**
- Status tracking using enum type for consistency
- Automatic timestamp updates on record modification
- Cascading deletion with voice agent
- Required fields ensure data completeness
- Optional notes field for additional information

**Note:** You can run the full `supabase_setup.sql` file (located in `/migrations/`) in your Supabase SQL Editor or via `psql`. This file sets up all necessary components including tables, triggers, functions, realtime notifications, and embedding table functions.

