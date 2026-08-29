CREATE TABLE "assessees" (
	"id" varchar PRIMARY KEY NOT NULL,
	"participant_id" varchar NOT NULL,
	"nik" text NOT NULL,
	"birth_place" text NOT NULL,
	"birth_date" text NOT NULL,
	"gender" text NOT NULL,
	"education" text NOT NULL,
	"work_experience" text NOT NULL,
	"current_company" text NOT NULL,
	"current_position" text NOT NULL,
	"scheme_id" varchar NOT NULL,
	"registration_date" text NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessors" (
	"id" varchar PRIMARY KEY NOT NULL,
	"registration_number" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"lsp_id" varchar NOT NULL,
	"competency_schemes" jsonb NOT NULL,
	"specializations" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"valid_until" text NOT NULL,
	"total_assessments" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"participant_id" varchar NOT NULL,
	"course_id" varchar,
	"learning_path_id" varchar,
	"assessment_id" varchar,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"certificate_number" text NOT NULL,
	"issued_at" text NOT NULL,
	"expires_at" text,
	"status" text DEFAULT 'active' NOT NULL,
	"verification_url" text NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint
CREATE TABLE "certification_results" (
	"id" varchar PRIMARY KEY NOT NULL,
	"schedule_id" varchar NOT NULL,
	"assessee_id" varchar NOT NULL,
	"assessor_id" varchar NOT NULL,
	"scheme_id" varchar NOT NULL,
	"unit_results" jsonb NOT NULL,
	"overall_result" text NOT NULL,
	"recommendations" text,
	"assessed_at" text NOT NULL,
	"certificate_id" varchar
);
--> statement-breakpoint
CREATE TABLE "clusters" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" varchar PRIMARY KEY NOT NULL,
	"unit_id" varchar NOT NULL,
	"target_level" varchar(4) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration" text NOT NULL,
	"lessons" jsonb NOT NULL,
	"pre_test_id" varchar,
	"post_test_id" varchar,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"participant_id" varchar NOT NULL,
	"course_id" varchar,
	"learning_path_id" varchar,
	"enrolled_at" text NOT NULL,
	"started_at" text,
	"completed_at" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"last_accessed_at" text
);
--> statement-breakpoint
CREATE TABLE "evidences" (
	"id" varchar PRIMARY KEY NOT NULL,
	"participant_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"file_url" text,
	"submitted_at" text NOT NULL,
	"assessed_at" text,
	"assessor_id" varchar,
	"score" integer,
	"feedback" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target_role" text NOT NULL,
	"duration" text NOT NULL,
	"difficulty" text NOT NULL,
	"course_ids" jsonb NOT NULL,
	"prerequisites" jsonb NOT NULL,
	"skills" jsonb NOT NULL,
	"is_published" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_records" (
	"id" varchar PRIMARY KEY NOT NULL,
	"participant_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsp_organizations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"license_number" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"lead_assessor_id" varchar,
	"competency_schemes" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"valid_until" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"is_read" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_competencies" (
	"id" varchar PRIMARY KEY NOT NULL,
	"participant_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"current_level" varchar(4) NOT NULL,
	"target_level" varchar(4) NOT NULL,
	"last_assessed" text NOT NULL,
	"status" text DEFAULT 'gap' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" varchar PRIMARY KEY NOT NULL,
	"nip" text NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"unit" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"assessee_id" varchar NOT NULL,
	"unit_id" varchar NOT NULL,
	"element_id" varchar,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"file_url" text,
	"issued_date" text,
	"issued_by" text,
	"submitted_at" text NOT NULL,
	"reviewed_at" text,
	"reviewed_by" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"quiz_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"time_spent" integer
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"course_id" varchar NOT NULL,
	"lesson_id" varchar,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit" integer,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"shuffle_questions" integer DEFAULT 0 NOT NULL,
	"show_results" integer DEFAULT 1 NOT NULL,
	"questions" jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" varchar PRIMARY KEY NOT NULL,
	"scheme_id" varchar NOT NULL,
	"assessee_id" varchar NOT NULL,
	"assessor_id" varchar NOT NULL,
	"scheduled_date" text NOT NULL,
	"location" text NOT NULL,
	"location_type" text NOT NULL,
	"methods" jsonb NOT NULL,
	"duration" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"lsp_id" varchar NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"skkni_code" text,
	"unit_ids" jsonb NOT NULL,
	"assessment_methods" jsonb NOT NULL,
	"duration" text NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" varchar PRIMARY KEY NOT NULL,
	"cluster_id" varchar NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"indicators" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_competencies" ADD CONSTRAINT "participant_competencies_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_competencies" ADD CONSTRAINT "participant_competencies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evidences_participant_id" ON "evidences" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_learning_records_participant_id" ON "learning_records" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_participant_competencies_participant_id" ON "participant_competencies" USING btree ("participant_id");