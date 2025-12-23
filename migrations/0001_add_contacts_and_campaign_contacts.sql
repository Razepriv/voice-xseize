-- Migration: Add contacts and campaign_contacts tables for persistent campaign/contact management

CREATE TABLE "contacts" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" varchar NOT NULL,
    "name" text NOT NULL,
    "email" varchar,
    "phone" varchar,
    "company" text,
    "status" varchar(50) DEFAULT 'active' NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE "campaign_contacts" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "campaign_id" varchar NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
    "contact_id" varchar NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
    "added_at" timestamp DEFAULT now(),
    CONSTRAINT "campaign_contact_unique" UNIQUE("campaign_id", "contact_id")
);
