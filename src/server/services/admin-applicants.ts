import "server-only";

import type { CandidateStatus } from "@prisma/client";

import { ADMIN_DIRECTORY_PAGE_SIZE } from "@/config/admin";
import { db } from "@/lib/db";
import { notFoundError } from "@/lib/errors";

export type ApplicantStatusFilter = "ALL" | CandidateStatus;

export interface ApplicantDirectoryRow {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone: string;
  residentialAddress?: string | null;
  city: string | null;
  state?: string | null;
  highestQualification?: string | null;
  institution?: string | null;
  courseOfStudy?: string | null;
  graduationYear?: string | null;
  cvUrl?: string | null;
  passportPhotoUrl?: string | null;
  idCardUrl?: string | null;
  status: CandidateStatus;
  createdAt: Date;
  updatedAt: Date;
  application: {
    roleTitle: string;
    status: "SUBMITTED" | "WITHDRAWN";
    submittedAt: Date;
  } | null;
}

export interface ApplicantDirectoryResult {
  applicants: ApplicantDirectoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const applicantSelect = {
  id: true,
  referenceNumber: true,
  fullName: true,
  email: true,
  phone: true,
  residentialAddress: true,
  city: true,
  state: true,
  highestQualification: true,
  institution: true,
  courseOfStudy: true,
  graduationYear: true,
  cvUrl: true,
  passportPhotoUrl: true,
  idCardUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  applications: {
    orderBy: { submittedAt: "desc" as const },
    take: 1,
    select: { roleTitle: true, status: true, submittedAt: true },
  },
};

function toDirectoryRow(row: {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone: string;
  residentialAddress?: string | null;
  city: string | null;
  state?: string | null;
  highestQualification?: string | null;
  institution?: string | null;
  courseOfStudy?: string | null;
  graduationYear?: string | null;
  cvUrl?: string | null;
  passportPhotoUrl?: string | null;
  idCardUrl?: string | null;
  status: CandidateStatus;
  createdAt: Date;
  updatedAt: Date;
  applications: Array<{
    roleTitle: string;
    status: "SUBMITTED" | "WITHDRAWN";
    submittedAt: Date;
  }>;
}): ApplicantDirectoryRow {
  return { ...row, application: row.applications[0] ?? null };
}

export async function listApplicants(query: {
  q?: string;
  status: ApplicantStatusFilter;
  page?: number;
}): Promise<ApplicantDirectoryResult> {
  const page = query.page ?? 1;
  const where = {
    ...(query.status === "ALL" ? {} : { status: query.status }),
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
            { phone: { contains: query.q, mode: "insensitive" as const } },
            {
              referenceNumber: {
                contains: query.q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.candidate.count({ where }),
    db.candidate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * ADMIN_DIRECTORY_PAGE_SIZE,
      take: ADMIN_DIRECTORY_PAGE_SIZE,
      select: applicantSelect,
    }),
  ]);

  return {
    applicants: rows.map(toDirectoryRow),
    page,
    pageSize: ADMIN_DIRECTORY_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_DIRECTORY_PAGE_SIZE)),
  };
}

export async function getApplicantDetail(id: string): Promise<ApplicantDirectoryRow> {
  const row = await db.candidate.findUnique({
    where: { id },
    select: applicantSelect,
  });
  if (!row) throw notFoundError("Applicant record not found.");
  return toDirectoryRow(row);
}
