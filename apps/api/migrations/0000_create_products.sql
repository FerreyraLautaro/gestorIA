CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"stock" integer NOT NULL,
	"status" "product_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_stock_non_negative" CHECK ("products"."stock" >= 0)
);
--> statement-breakpoint
CREATE INDEX "products_owner_id_created_at_idx" ON "products" USING btree ("owner_id","created_at");