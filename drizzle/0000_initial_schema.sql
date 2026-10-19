CREATE TYPE "public"."device_status" AS ENUM('PENDING_ACTIVATION', 'ACTIVE', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('TICKET_GENERATOR', 'QUEUE_DISPLAY');--> statement-breakpoint
CREATE TYPE "public"."license_status" AS ENUM('ACTIVE', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."operator_session_end_reason" AS ENUM('USER_LEFT', 'FORCED_BY_USER', 'SERVICE_POINT_DISABLED', 'ADMIN_ACTION');--> statement-breakpoint
CREATE TYPE "public"."operator_session_status" AS ENUM('ACTIVE', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."ticket_event_type" AS ENUM('CREATED', 'CALLED', 'RECALLED', 'FINISHED', 'CANCELLED', 'NO_SHOW', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('WAITING', 'IN_SERVICE', 'FINISHED', 'NO_SHOW', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'ATTENDANT', 'VIEWER');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"document" varchar(14) NOT NULL,
	"contact_email" varchar(200) NOT NULL,
	"contact_phone" varchar(11) NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"terms_version" varchar(20) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_organizations_slug" UNIQUE("slug"),
	CONSTRAINT "uq_organizations_document" UNIQUE("document"),
	CONSTRAINT "chk_organizations_slug_format" CHECK ("organizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("organizations"."slug") BETWEEN 3 AND 60),
	CONSTRAINT "chk_organizations_document_format" CHECK ("organizations"."document" ~ '^([0-9]{11}|[0-9]{14})$'),
	CONSTRAINT "chk_organizations_contact_phone_format" CHECK ("organizations"."contact_phone" ~ '^[0-9]{10,11}$'),
	CONSTRAINT "chk_organizations_contact_email_lowercase" CHECK ("organizations"."contact_email" = lower("organizations"."contact_email"))
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "license_status" DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_licenses_organization" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(150) NOT NULL,
	"username" varchar(60) NOT NULL,
	"email" varchar(200),
	"password_hash" varchar(255) NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_users_organization_username" UNIQUE("organization_id","username"),
	CONSTRAINT "uq_users_organization_email" UNIQUE("organization_id","email"),
	CONSTRAINT "chk_users_username_format" CHECK ("users"."username" ~ '^[a-z0-9]+([._][a-z0-9]+)*$'),
	CONSTRAINT "chk_users_email_lowercase" CHECK ("users"."email" IS NULL OR "users"."email" = lower("users"."email")),
	CONSTRAINT "chk_users_owner_email" CHECK ("users"."role" <> 'OWNER' OR "users"."email" IS NOT NULL),
	CONSTRAINT "chk_users_branch_by_role" CHECK (("users"."role" IN ('OWNER', 'ADMIN') AND "users"."branch_id" IS NULL) OR ("users"."role" NOT IN ('OWNER', 'ADMIN') AND "users"."branch_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"prefix" varchar(4) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_departments_branch_prefix" UNIQUE("branch_id","prefix"),
	CONSTRAINT "chk_departments_prefix_format" CHECK ("departments"."prefix" ~ '^[A-Z0-9]{1,4}$')
);
--> statement-breakpoint
CREATE TABLE "service_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "department_service_points" (
	"department_id" uuid NOT NULL,
	"service_point_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_service_points_pkey" PRIMARY KEY("department_id","service_point_id")
);
--> statement-breakpoint
CREATE TABLE "user_department_access" (
	"user_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_department_access_pkey" PRIMARY KEY("user_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "operator_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_point_id" uuid NOT NULL,
	"status" "operator_session_status" DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_user_id" uuid,
	"end_reason" "operator_session_end_reason",
	CONSTRAINT "chk_operator_session_closed_data" CHECK ("operator_sessions"."status" <> 'CLOSED' OR ( "operator_sessions"."ended_at" IS NOT NULL AND "operator_sessions"."ended_by_user_id" IS NOT NULL AND "operator_sessions"."end_reason" IS NOT NULL )),
	CONSTRAINT "chk_operator_session_active_data" CHECK ("operator_sessions"."status" <> 'ACTIVE' OR ( "operator_sessions"."ended_at" IS NULL AND "operator_sessions"."ended_by_user_id" IS NULL AND "operator_sessions"."end_reason" IS NULL ))
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"status" "ticket_status" DEFAULT 'WAITING' NOT NULL,
	"service_date" date NOT NULL,
	"service_point_id" uuid,
	"operator_session_id" uuid,
	"cancel_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "uq_tickets_branch_code_date" UNIQUE("branch_id","code","service_date")
);
--> statement-breakpoint
CREATE TABLE "ticket_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_type" "ticket_event_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_device_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "device_type" NOT NULL,
	"status" "device_status" DEFAULT 'PENDING_ACTIVATION' NOT NULL,
	"credential_hash" varchar(255),
	"activation_code" varchar(20),
	"activation_code_expires_at" timestamp with time zone,
	"activation_code_used_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_device_departments" (
	"public_device_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_device_departments_pkey" PRIMARY KEY("public_device_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_service_points" ADD CONSTRAINT "department_service_points_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_service_points" ADD CONSTRAINT "department_service_points_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "public"."service_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_department_access" ADD CONSTRAINT "user_department_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_department_access" ADD CONSTRAINT "user_department_access_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "public"."service_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_ended_by_user_id_fkey" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "public"."service_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_operator_session_id_fkey" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "fk_ticket_history_actor_device" FOREIGN KEY ("actor_device_id") REFERENCES "public"."public_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_devices" ADD CONSTRAINT "public_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_devices" ADD CONSTRAINT "public_devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_device_departments" ADD CONSTRAINT "public_device_departments_public_device_id_fkey" FOREIGN KEY ("public_device_id") REFERENCES "public"."public_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_device_departments" ADD CONSTRAINT "public_device_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_branches_organization" ON "branches" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_owner_email" ON "users" USING btree ("email") WHERE "users"."role" = 'OWNER';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_single_owner" ON "users" USING btree ("organization_id") WHERE "users"."role" = 'OWNER';--> statement-breakpoint
CREATE INDEX "ix_service_points_branch" ON "service_points" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "ix_department_service_points_service_point" ON "department_service_points" USING btree ("service_point_id");--> statement-breakpoint
CREATE INDEX "ix_user_department_access_department" ON "user_department_access" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_operator_sessions_active_user" ON "operator_sessions" USING btree ("user_id") WHERE "operator_sessions"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_operator_sessions_active_service_point" ON "operator_sessions" USING btree ("service_point_id") WHERE "operator_sessions"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "ix_operator_sessions_user_history" ON "operator_sessions" USING btree ("user_id","started_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "ix_operator_sessions_service_point_history" ON "operator_sessions" USING btree ("service_point_id","started_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "ix_tickets_queue_lookup" ON "tickets" USING btree ("department_id","service_date","created_at","id") WHERE "tickets"."status" = 'WAITING';--> statement-breakpoint
CREATE INDEX "ix_tickets_organization_service_date" ON "tickets" USING btree ("organization_id","service_date");--> statement-breakpoint
CREATE INDEX "ix_tickets_branch_service_date" ON "tickets" USING btree ("branch_id","service_date");--> statement-breakpoint
CREATE INDEX "ix_tickets_department_service_date" ON "tickets" USING btree ("department_id","service_date");--> statement-breakpoint
CREATE INDEX "ix_ticket_history_ticket" ON "ticket_history" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_audit_logs_organization_created_at" ON "audit_logs" USING btree ("organization_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "ix_audit_logs_actor" ON "audit_logs" USING btree ("actor_user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "ix_public_devices_organization" ON "public_devices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ix_public_devices_status" ON "public_devices" USING btree ("organization_id","status");