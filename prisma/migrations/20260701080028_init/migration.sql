-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
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
    "user_id" TEXT,
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
CREATE TABLE "manager_pin" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "pin_hash" TEXT,
    "set_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "manager_pin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Vientiane',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'lo-LA',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'LAK',
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
    "user_id" TEXT,
    "organization_id" TEXT,
    "role_id" TEXT,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by_id" TEXT,
    "invitation_expires_at" TIMESTAMP(3),
    "invitation_token_hash" TEXT,
    "accepted_at" TIMESTAMP(3),
    "role_expires_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "branch_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
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
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "module" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "parent_role_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT,
    "code" TEXT,
    "address" TEXT,
    "type" TEXT,
    "vertical" TEXT,
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Vientiane',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'LAK',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'lo-LA',
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "service_fee_bps" INTEGER NOT NULL DEFAULT 0,
    "prices_include_tax" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "description" TEXT,
    "i18n_key" TEXT,
    "billing_interval" TEXT,
    "base_price_cents" INTEGER NOT NULL DEFAULT 0,
    "annual_discount_bps" INTEGER NOT NULL DEFAULT 2000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "provider_price_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_module" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT,
    "module_code" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "add_on_price_cents" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plan_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_limit" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT,
    "limit_key" TEXT,
    "limit_value" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plan_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscription" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "plan_id" TEXT,
    "status" TEXT,
    "billing_interval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "grace_until" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "renewal_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_module" (
    "id" TEXT NOT NULL,
    "organization_subscription_id" TEXT,
    "module_code" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscription_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT,
    "module" TEXT,
    "i18n_key" TEXT,
    "description" TEXT,
    "is_metered" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_feature" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT,
    "feature_code" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,
    "is_addon" BOOLEAN NOT NULL DEFAULT false,
    "i18n_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plan_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_override" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "kind" TEXT,
    "code" TEXT,
    "enabled" BOOLEAN,
    "limit_value" INTEGER,
    "reason" TEXT,
    "granted_by_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

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
CREATE INDEX "manager_pin_organization_id_idx" ON "manager_pin"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_pin_organization_id_user_id_key" ON "manager_pin"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_deletion_scheduled_at_idx" ON "organization"("deletion_scheduled_at");

-- CreateIndex
CREATE INDEX "organization_member_organization_id_idx" ON "organization_member"("organization_id");

-- CreateIndex
CREATE INDEX "organization_member_invitation_token_hash_idx" ON "organization_member"("invitation_token_hash");

-- CreateIndex
CREATE INDEX "organization_member_accepted_at_idx" ON "organization_member"("accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_user_id_organization_id_key" ON "organization_member"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE INDEX "role_organization_id_idx" ON "role"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_organization_id_name_key" ON "role"("organization_id", "name");

-- CreateIndex
CREATE INDEX "branch_organization_id_idx" ON "branch"("organization_id");

-- CreateIndex
CREATE INDEX "branch_organization_id_vertical_idx" ON "branch"("organization_id", "vertical");

-- CreateIndex
CREATE INDEX "branch_organization_id_is_main_idx" ON "branch"("organization_id", "is_main");

-- CreateIndex
CREATE UNIQUE INDEX "branch_organization_id_code_key" ON "branch"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "plan_slug_key" ON "plan"("slug");

-- CreateIndex
CREATE INDEX "plan_is_active_is_public_sort_order_idx" ON "plan"("is_active", "is_public", "sort_order");

-- CreateIndex
CREATE INDEX "plan_module_plan_id_idx" ON "plan_module"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_module_plan_id_module_code_key" ON "plan_module"("plan_id", "module_code");

-- CreateIndex
CREATE INDEX "plan_limit_plan_id_idx" ON "plan_limit"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_limit_plan_id_limit_key_key" ON "plan_limit"("plan_id", "limit_key");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscription_organization_id_key" ON "organization_subscription"("organization_id");

-- CreateIndex
CREATE INDEX "organization_subscription_status_current_period_end_idx" ON "organization_subscription"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "organization_subscription_trial_end_idx" ON "organization_subscription"("trial_end");

-- CreateIndex
CREATE INDEX "subscription_module_organization_subscription_id_idx" ON "subscription_module"("organization_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_module_organization_subscription_id_module_cod_key" ON "subscription_module"("organization_subscription_id", "module_code");

-- CreateIndex
CREATE UNIQUE INDEX "feature_code_key" ON "feature"("code");

-- CreateIndex
CREATE INDEX "feature_module_idx" ON "feature"("module");

-- CreateIndex
CREATE INDEX "feature_is_active_idx" ON "feature"("is_active");

-- CreateIndex
CREATE INDEX "plan_feature_plan_id_idx" ON "plan_feature"("plan_id");

-- CreateIndex
CREATE INDEX "plan_feature_feature_code_idx" ON "plan_feature"("feature_code");

-- CreateIndex
CREATE UNIQUE INDEX "plan_feature_plan_id_feature_code_key" ON "plan_feature"("plan_id", "feature_code");

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
ALTER TABLE "manager_pin" ADD CONSTRAINT "manager_pin_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_pin" ADD CONSTRAINT "manager_pin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch" ADD CONSTRAINT "branch_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_module" ADD CONSTRAINT "plan_module_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_limit" ADD CONSTRAINT "plan_limit_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_module" ADD CONSTRAINT "subscription_module_organization_subscription_id_fkey" FOREIGN KEY ("organization_subscription_id") REFERENCES "organization_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_feature" ADD CONSTRAINT "plan_feature_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_feature" ADD CONSTRAINT "plan_feature_feature_code_fkey" FOREIGN KEY ("feature_code") REFERENCES "feature"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_override" ADD CONSTRAINT "entitlement_override_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
