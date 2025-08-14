CREATE TABLE IF NOT EXISTS "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tour_id" integer,
	"status" text NOT NULL,
	"booking_details" jsonb,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"chat_title" text,
	"member_ids" jsonb DEFAULT '[]'::jsonb,
	"aggregated_profile" jsonb,
	"aggregated_priorities" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "group_profiles_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_tour_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer,
	"tour_id" integer,
	"user_id" text NOT NULL,
	"vote" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitoring_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"profile_id" integer,
	"watchlist_id" integer,
	"group_id" integer,
	"task_type" text NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"last_run_at" timestamp,
	"status" text DEFAULT 'active',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"departure_city" text,
	"vacation_type" text,
	"countries" jsonb,
	"budget" integer,
	"start_date" date,
	"end_date" date,
	"trip_duration" integer,
	"priorities" jsonb,
	"adults" integer DEFAULT 2,
	"children" integer DEFAULT 0,
	"children_ages" jsonb,
	"preferences" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tour_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tour_id" integer,
	"user_id" text,
	"profile_id" integer,
	"group_id" integer,
	"match_score" real NOT NULL,
	"match_details" jsonb,
	"is_notified" boolean DEFAULT false,
	"notified_at" timestamp,
	"user_action" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tour_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"tour_id" integer,
	"parameter_type" text NOT NULL,
	"parameter_value" real,
	"parameter_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tour_priorities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"star_rating" real DEFAULT 5,
	"beach_line" real DEFAULT 5,
	"meal_type" real DEFAULT 5,
	"hotel_rating" real DEFAULT 5,
	"price_value" real DEFAULT 8,
	"room_quality" real DEFAULT 5,
	"location" real DEFAULT 5,
	"family_friendly" real DEFAULT 5,
	"adults" real DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tours" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"country" text,
	"resort" text,
	"hotel_name" text,
	"star_rating" integer,
	"beach_line" integer,
	"meal_type" text,
	"price" integer NOT NULL,
	"price_per_person" boolean DEFAULT false,
	"currency" text DEFAULT 'RUB',
	"departure_date" timestamp,
	"return_date" timestamp,
	"duration" integer,
	"hotel_rating" real,
	"reviews_count" integer,
	"photo_url" text,
	"details_url" text,
	"booking_url" text,
	"metadata" jsonb,
	"match_score" real,
	"ai_analysis" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_buddy_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"destination" text,
	"date_range" jsonb,
	"budget" integer,
	"preferences" jsonb,
	"status" text DEFAULT 'active',
	"matched_with" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"description" text,
	"countries" jsonb,
	"budget_range" jsonb,
	"priorities" jsonb,
	"is_active" boolean DEFAULT true,
	"last_checked" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_tour_votes" ADD CONSTRAINT "group_tour_votes_group_id_group_profiles_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_tour_votes" ADD CONSTRAINT "group_tour_votes_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitoring_tasks" ADD CONSTRAINT "monitoring_tasks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitoring_tasks" ADD CONSTRAINT "monitoring_tasks_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitoring_tasks" ADD CONSTRAINT "monitoring_tasks_group_id_group_profiles_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tour_matches" ADD CONSTRAINT "tour_matches_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tour_matches" ADD CONSTRAINT "tour_matches_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tour_matches" ADD CONSTRAINT "tour_matches_group_id_group_profiles_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tour_parameters" ADD CONSTRAINT "tour_parameters_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_vote" ON "group_tour_votes" USING btree ("group_id","tour_id","user_id");