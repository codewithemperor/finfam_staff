-- CreateTable
CREATE TABLE "staff_training_enrollments" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_training_lesson_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_training_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_training_enrollments_staffId_courseId_idx" ON "staff_training_enrollments"("staffId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_training_enrollments_staffId_courseId_courseVersion_key" ON "staff_training_enrollments"("staffId", "courseId", "courseVersion");

-- CreateIndex
CREATE INDEX "staff_training_lesson_progress_enrollmentId_idx" ON "staff_training_lesson_progress"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_training_lesson_progress_enrollmentId_lessonId_key" ON "staff_training_lesson_progress"("enrollmentId", "lessonId");

-- AddForeignKey
ALTER TABLE "staff_training_enrollments" ADD CONSTRAINT "staff_training_enrollments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_training_lesson_progress" ADD CONSTRAINT "staff_training_lesson_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "staff_training_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
