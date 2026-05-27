CREATE TYPE "public"."user_role" AS ENUM('agent', 'assistant', 'admin');--> statement-breakpoint
CREATE TYPE "public"."tour_status" AS ENUM('draft', 'active', 'published', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."skip_reason" AS ENUM('not_approved', 'client_changed_mind', 'running_late', 'access_issue', 'traffic', 'duplicate_choice', 'other');--> statement-breakpoint
CREATE TYPE "public"."showing_status" AS ENUM('not_requested', 'requested', 'pending', 'approved', 'declined', 'needs_follow_up', 'restricted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transcription_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."debrief_processing_status" AS ENUM('pending', 'transcribing', 'scoring', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"is_system_account" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"notes" text,
	"preference_profile" text,
	"preference_profile_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"formatted_address" text NOT NULL,
	"place_id" varchar(512),
	"lat" double precision,
	"lng" double precision,
	"city" varchar(255),
	"state" varchar(100),
	"zip" varchar(20),
	"mls_id" varchar(100),
	"list_price" integer,
	"beds" integer,
	"baths" double precision,
	"square_feet" integer,
	"nickname" varchar(255),
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tours" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"buyer_id" varchar(36),
	"agent_id" varchar(36) NOT NULL,
	"title" varchar(255) NOT NULL,
	"date" varchar(20) NOT NULL,
	"start_time" varchar(10),
	"start_address" text,
	"start_lat" double precision,
	"start_lng" double precision,
	"end_address" text,
	"end_lat" double precision,
	"end_lng" double precision,
	"buyer_notes" text,
	"geographic_area" varchar(255),
	"tags" text[],
	"status" "tour_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_stops" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_id" varchar(36) NOT NULL,
	"property_id" varchar(36) NOT NULL,
	"sequence" integer NOT NULL,
	"approved_status" varchar(50) DEFAULT 'not_requested' NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	"skip_reason" "skip_reason",
	"skip_notes" text,
	"visited" boolean DEFAULT false NOT NULL,
	"arrival_time" timestamp with time zone,
	"departure_time" timestamp with time zone,
	"buyer_interest" integer,
	"kitchen_rating" integer,
	"primary_suite_rating" integer,
	"backyard_rating" integer,
	"road_noise_rating" integer,
	"overall_fit_rating" integer,
	"follow_up_flag" boolean DEFAULT false NOT NULL,
	"revisit_flag" boolean DEFAULT false NOT NULL,
	"quick_tags" text[],
	"predicted_fit_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showing_requests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_stop_id" varchar(36) NOT NULL,
	"listing_agent_name" varchar(255),
	"brokerage_name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"request_method" varchar(100),
	"requested_at" timestamp with time zone,
	"requested_window_start" varchar(20),
	"requested_window_end" varchar(20),
	"status" "showing_status" DEFAULT 'not_requested' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restriction_notes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_stop_id" varchar(36) NOT NULL,
	"occupied" boolean DEFAULT false NOT NULL,
	"tenant_notice_required" boolean DEFAULT false NOT NULL,
	"gate_code" varchar(100),
	"alarm_instructions" text,
	"pet_instructions" text,
	"do_not_use_bathroom" boolean DEFAULT false NOT NULL,
	"remove_shoes" boolean DEFAULT false NOT NULL,
	"parking_instructions" text,
	"time_restriction" varchar(255),
	"offer_deadline_note" text,
	"free_text_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_agent_contacts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_stop_id" varchar(36) NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"brokerage_name" varchar(255),
	"preferred_contact_method" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_notes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_stop_id" varchar(36) NOT NULL,
	"file_url" text NOT NULL,
	"duration_seconds" integer,
	"transcription_status" "transcription_status" DEFAULT 'pending' NOT NULL,
	"typed_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"voice_note_id" varchar(36) NOT NULL,
	"text" text NOT NULL,
	"provider" varchar(100),
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_summaries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_stop_id" varchar(36) NOT NULL,
	"summary_text" text NOT NULL,
	"positives" text[],
	"negatives" text[],
	"questions" text[],
	"provider" varchar(100),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_summaries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_id" varchar(36) NOT NULL,
	"summary_text" text NOT NULL,
	"top_homes" text[],
	"homes_to_eliminate" text[],
	"buyer_preferences" text[],
	"next_actions" text[],
	"provider" varchar(100),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debrief_voice_notes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tour_stop_id" varchar(36) NOT NULL,
	"buyer_id" varchar(36),
	"file_url" text,
	"duration_seconds" integer,
	"transcript" text,
	"ai_summary" text,
	"fit_score" integer,
	"fit_score_positives" text[],
	"fit_score_negatives" text[],
	"fit_score_verdict" text,
	"processing_status" "debrief_processing_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showing_requests" ADD CONSTRAINT "showing_requests_tour_stop_id_tour_stops_id_fk" FOREIGN KEY ("tour_stop_id") REFERENCES "public"."tour_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restriction_notes" ADD CONSTRAINT "restriction_notes_tour_stop_id_tour_stops_id_fk" FOREIGN KEY ("tour_stop_id") REFERENCES "public"."tour_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_agent_contacts" ADD CONSTRAINT "listing_agent_contacts_tour_stop_id_tour_stops_id_fk" FOREIGN KEY ("tour_stop_id") REFERENCES "public"."tour_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_tour_stop_id_tour_stops_id_fk" FOREIGN KEY ("tour_stop_id") REFERENCES "public"."tour_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_voice_note_id_voice_notes_id_fk" FOREIGN KEY ("voice_note_id") REFERENCES "public"."voice_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_summaries" ADD CONSTRAINT "property_summaries_tour_stop_id_tour_stops_id_fk" FOREIGN KEY ("tour_stop_id") REFERENCES "public"."tour_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_summaries" ADD CONSTRAINT "tour_summaries_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debrief_voice_notes" ADD CONSTRAINT "debrief_voice_notes_tour_stop_id_tour_stops_id_fk" FOREIGN KEY ("tour_stop_id") REFERENCES "public"."tour_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debrief_voice_notes" ADD CONSTRAINT "debrief_voice_notes_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");