-- CreateIndex
CREATE INDEX "contacts_userId_subscribed_idx" ON "contacts"("userId", "subscribed");

-- CreateIndex
CREATE INDEX "contacts_userId_createdAt_idx" ON "contacts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "contacts_userId_updatedAt_idx" ON "contacts"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "messages_userId_direction_status_createdAt_idx" ON "messages"("userId", "direction", "status", "createdAt");

-- CreateIndex
CREATE INDEX "messages_userId_direction_createdAt_idx" ON "messages"("userId", "direction", "createdAt");
