CREATE SCHEMA "games";
--> statement-breakpoint
CREATE TABLE "games"."athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"number" integer,
	"gender" text,
	"position" text,
	"is_captain" boolean DEFAULT false NOT NULL,
	"photo_media_id" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_media_id" text,
	"overall_enabled" boolean DEFAULT false NOT NULL,
	"points_table" jsonb DEFAULT '[100,80,65,55,45,40,35,30,25,20,15,10]'::jsonb NOT NULL,
	"overall_includes_partial" boolean DEFAULT true NOT NULL,
	"data_version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "games"."modalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"description" text,
	"cover_media_id" text,
	"sport_profile" text NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"points_table" jsonb,
	"status" text DEFAULT 'setup' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."modality_entries" (
	"modality_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"seed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "modality_entries_modality_id_participant_id_pk" PRIMARY KEY("modality_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "games"."modality_placements" (
	"modality_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "modality_placements_modality_id_participant_id_pk" PRIMARY KEY("modality_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "games"."participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"crest_media_id" text,
	"primary_color" text,
	"secondary_color" text,
	"description" text,
	"founded_date" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."score_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"modality_id" uuid,
	"points" real NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."tournament_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"shape" text DEFAULT 'match' NOT NULL,
	"stages" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."live_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"current_match_id" uuid,
	"teaser" text,
	"version" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."match_boosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"side" text NOT NULL,
	"boost_id" uuid,
	"label" text NOT NULL,
	"emoji" text NOT NULL,
	"clock_ms" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"side" text NOT NULL,
	"athlete_id" uuid,
	"amount" real DEFAULT 1 NOT NULL,
	"clock_ms" bigint,
	"period" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."match_live" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"clock_running" boolean DEFAULT false NOT NULL,
	"clock_anchor_ms" bigint,
	"clock_accumulated_ms" bigint DEFAULT 0 NOT NULL,
	"period" integer DEFAULT 1 NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"modality_id" uuid NOT NULL,
	"stage_id" uuid,
	"group_id" uuid,
	"match_key" text,
	"round_number" integer,
	"round_label" text,
	"bracket_round" integer,
	"bracket_position" integer,
	"is_third_place" boolean DEFAULT false NOT NULL,
	"home_participant_id" uuid,
	"away_participant_id" uuid,
	"home_source" jsonb,
	"away_source" jsonb,
	"home_label" text,
	"away_label" text,
	"slots_locked" boolean DEFAULT false NOT NULL,
	"scheduled_date" date,
	"scheduled_time" time,
	"venue" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"home_score" real DEFAULT 0 NOT NULL,
	"away_score" real DEFAULT 0 NOT NULL,
	"sets" jsonb,
	"decided_winner_id" uuid,
	"result_note" text,
	"mvp_athlete_id" uuid,
	"mvp_note" text,
	"youtube_url" text,
	"cover_photo_media_id" text,
	"cover_image_media_id" text,
	"story_image_media_id" text,
	"share_images_hash" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."power_boosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"label" text NOT NULL,
	"emoji" text DEFAULT '⚡' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."stage_group_members" (
	"group_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "stage_group_members_group_id_participant_id_pk" PRIMARY KEY("group_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "games"."stage_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."stage_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"value" real,
	"judge_scores" jsonb,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modality_id" uuid NOT NULL,
	"stage_index" integer NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."vote_network_slots" (
	"poll_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"issued" integer DEFAULT 0 NOT NULL,
	"next_slot_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_network_slots_poll_id_ip_hash_pk" PRIMARY KEY("poll_id","ip_hash")
);
--> statement-breakpoint
CREATE TABLE "games"."vote_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"match_id" uuid,
	"title" text NOT NULL,
	"open_mode" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games"."vote_tallies" (
	"poll_id" uuid NOT NULL,
	"choice_id" uuid NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vote_tallies_poll_id_choice_id_pk" PRIMARY KEY("poll_id","choice_id")
);
--> statement-breakpoint
CREATE TABLE "games"."votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"choice_id" uuid NOT NULL,
	"voter_key" text NOT NULL,
	"ip_hash" text,
	"ua_hash" text,
	"ticket_nonce" text NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games"."athletes" ADD CONSTRAINT "athletes_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."athletes" ADD CONSTRAINT "athletes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."modalities" ADD CONSTRAINT "modalities_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."modality_entries" ADD CONSTRAINT "modality_entries_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "games"."modalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."modality_entries" ADD CONSTRAINT "modality_entries_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."modality_placements" ADD CONSTRAINT "modality_placements_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "games"."modalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."modality_placements" ADD CONSTRAINT "modality_placements_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."participants" ADD CONSTRAINT "participants_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."score_adjustments" ADD CONSTRAINT "score_adjustments_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."score_adjustments" ADD CONSTRAINT "score_adjustments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."score_adjustments" ADD CONSTRAINT "score_adjustments_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "games"."modalities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."live_channels" ADD CONSTRAINT "live_channels_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."live_channels" ADD CONSTRAINT "live_channels_current_match_id_matches_id_fk" FOREIGN KEY ("current_match_id") REFERENCES "games"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."match_boosts" ADD CONSTRAINT "match_boosts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "games"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."match_boosts" ADD CONSTRAINT "match_boosts_boost_id_power_boosts_id_fk" FOREIGN KEY ("boost_id") REFERENCES "games"."power_boosts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "games"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."match_events" ADD CONSTRAINT "match_events_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "games"."athletes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."match_live" ADD CONSTRAINT "match_live_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "games"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "games"."modalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "games"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_group_id_stage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "games"."stage_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_home_participant_id_participants_id_fk" FOREIGN KEY ("home_participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_away_participant_id_participants_id_fk" FOREIGN KEY ("away_participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_decided_winner_id_participants_id_fk" FOREIGN KEY ("decided_winner_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."matches" ADD CONSTRAINT "matches_mvp_athlete_id_athletes_id_fk" FOREIGN KEY ("mvp_athlete_id") REFERENCES "games"."athletes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."power_boosts" ADD CONSTRAINT "power_boosts_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."stage_group_members" ADD CONSTRAINT "stage_group_members_group_id_stage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "games"."stage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."stage_group_members" ADD CONSTRAINT "stage_group_members_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."stage_groups" ADD CONSTRAINT "stage_groups_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "games"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."stage_results" ADD CONSTRAINT "stage_results_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "games"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."stage_results" ADD CONSTRAINT "stage_results_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "games"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."stages" ADD CONSTRAINT "stages_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "games"."modalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."vote_network_slots" ADD CONSTRAINT "vote_network_slots_poll_id_vote_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "games"."vote_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."vote_polls" ADD CONSTRAINT "vote_polls_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "games"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."vote_polls" ADD CONSTRAINT "vote_polls_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "games"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."vote_tallies" ADD CONSTRAINT "vote_tallies_poll_id_vote_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "games"."vote_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games"."votes" ADD CONSTRAINT "votes_poll_id_vote_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "games"."vote_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athletes_competition_slug_unique" ON "games"."athletes" USING btree ("competition_id","slug");--> statement-breakpoint
CREATE INDEX "athletes_participant_idx" ON "games"."athletes" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modalities_competition_slug_unique" ON "games"."modalities" USING btree ("competition_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_competition_slug_unique" ON "games"."participants" USING btree ("competition_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "live_channels_competition_key_unique" ON "games"."live_channels" USING btree ("competition_id","key");--> statement-breakpoint
CREATE INDEX "match_boosts_match_idx" ON "games"."match_boosts" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_events_match_idx" ON "games"."match_events" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_competition_status_idx" ON "games"."matches" USING btree ("competition_id","status");--> statement-breakpoint
CREATE INDEX "matches_modality_idx" ON "games"."matches" USING btree ("modality_id");--> statement-breakpoint
CREATE INDEX "matches_stage_idx" ON "games"."matches" USING btree ("stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_results_stage_participant_unique" ON "games"."stage_results" USING btree ("stage_id","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_modality_index_unique" ON "games"."stages" USING btree ("modality_id","stage_index");--> statement-breakpoint
CREATE UNIQUE INDEX "vote_polls_match_unique" ON "games"."vote_polls" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_poll_voter_unique" ON "games"."votes" USING btree ("poll_id","voter_key");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_ticket_nonce_unique" ON "games"."votes" USING btree ("ticket_nonce");--> statement-breakpoint
CREATE INDEX "votes_poll_ip_idx" ON "games"."votes" USING btree ("poll_id","ip_hash");