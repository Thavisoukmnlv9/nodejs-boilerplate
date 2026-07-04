-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PolicyEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_platform_staff" BOOLEAN NOT NULL DEFAULT false,
    "platform_staff_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "refresh_token_hash" TEXT,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "device_info" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_fingerprint" TEXT,
    "is_suspicious" BOOLEAN NOT NULL DEFAULT false,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "business_legal_name" TEXT,
    "tax_id" TEXT,
    "billing_email" TEXT,
    "support_tier" TEXT,
    "deletion_scheduled_at" TIMESTAMP(3),
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_member" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role_id" TEXT,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by_id" TEXT,
    "invitation_expires_at" TIMESTAMP(3),
    "invitation_token_hash" TEXT,
    "accepted_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "default_branch_id" TEXT,
    "staff_id" TEXT,
    "staff_title" TEXT,
    "staff_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_branch_access" (
    "member_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_branch_access_pkey" PRIMARY KEY ("member_id","branch_id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "policy" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role_id" TEXT,
    "effect" "PolicyEffect" NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "conditions" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "type" TEXT,
    "vertical" TEXT,
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "service_fee_bps" INTEGER NOT NULL DEFAULT 0,
    "prices_include_tax" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_override" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT,
    "code" TEXT,
    "enabled" BOOLEAN,
    "limit_value" INTEGER,
    "reason" TEXT,
    "granted_by_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "bucket" TEXT,
    "key" TEXT,
    "filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "session_refresh_token_hash_idx" ON "session"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "session_ip_address_idx" ON "session"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_deletion_scheduled_at_idx" ON "organization"("deletion_scheduled_at");

-- CreateIndex
CREATE INDEX "organization_member_organization_id_idx" ON "organization_member"("organization_id");

-- CreateIndex
CREATE INDEX "organization_member_organization_id_role_id_idx" ON "organization_member"("organization_id", "role_id");

-- CreateIndex
CREATE INDEX "organization_member_invitation_token_hash_idx" ON "organization_member"("invitation_token_hash");

-- CreateIndex
CREATE INDEX "organization_member_accepted_at_idx" ON "organization_member"("accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_user_id_organization_id_key" ON "organization_member"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "member_branch_access_branch_id_idx" ON "member_branch_access"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE INDEX "role_organization_id_idx" ON "role"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_organization_id_name_key" ON "role"("organization_id", "name");

-- CreateIndex
CREATE INDEX "policy_organization_id_subject_action_idx" ON "policy"("organization_id", "subject", "action");

-- CreateIndex
CREATE INDEX "branch_organization_id_idx" ON "branch"("organization_id");

-- CreateIndex
CREATE INDEX "branch_organization_id_vertical_idx" ON "branch"("organization_id", "vertical");

-- CreateIndex
CREATE INDEX "branch_organization_id_is_main_idx" ON "branch"("organization_id", "is_main");

-- CreateIndex
CREATE INDEX "branch_organization_id_is_active_idx" ON "branch"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "branch_organization_id_code_key" ON "branch"("organization_id", "code");

-- CreateIndex
CREATE INDEX "entitlement_override_expires_at_idx" ON "entitlement_override"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_override_organization_id_kind_code_key" ON "entitlement_override"("organization_id", "kind", "code");

-- CreateIndex
CREATE INDEX "file_organization_id_idx" ON "file"("organization_id");

-- CreateIndex
CREATE INDEX "file_bucket_key_idx" ON "file"("bucket", "key");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_default_branch_id_fkey" FOREIGN KEY ("default_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_branch_access" ADD CONSTRAINT "member_branch_access_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "organization_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_branch_access" ADD CONSTRAINT "member_branch_access_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch" ADD CONSTRAINT "branch_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_override" ADD CONSTRAINT "entitlement_override_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

