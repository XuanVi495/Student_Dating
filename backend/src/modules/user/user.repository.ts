import {
  UserRole,
  VerificationStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../database/prisma.js';

export interface VerificationRecord {
  studentId: string;
  studentNumber: string | null;
  universityName: string | null;
  cardStoragePath: string | null;
  status: VerificationStatus;
  reviewerId: string | null;
  rejectionReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

export interface UserRepository {
  studentExists(userId: string): Promise<boolean>;
  getRole(userId: string): Promise<UserRole | undefined>;
  assignRole(
    userId: string,
    role: typeof UserRole.MODERATOR | typeof UserRole.ADMIN
  ): Promise<{
    userId: string;
    role: UserRole;
    updatedAt: Date;
  }>;
  getVerificationStatus(userId: string): Promise<VerificationStatus | undefined>;
  getVerification(userId: string): Promise<VerificationRecord | undefined>;
  listPendingVerifications(): Promise<readonly VerificationRecord[]>;
  submitVerification(
    userId: string,
    cardStoragePath: string
  ): Promise<VerificationRecord | undefined>;
  reviewVerification(
    userId: string,
    reviewerId: string,
    status: typeof VerificationStatus.DA_XAC_THUC | typeof VerificationStatus.TU_CHOI,
    rejectionReason?: string
  ): Promise<{
    studentId: string;
    status: VerificationStatus;
    reviewerId: string | null;
    rejectionReason: string | null;
    reviewedAt: Date | null;
  } | undefined>;
}

export function createUserRepository(
  client: PrismaClient = prisma
): UserRepository {
  const verificationSelect = {
    studentId: true,
    studentNumber: true,
    universityName: true,
    cardStoragePath: true,
    status: true,
    reviewerId: true,
    rejectionReason: true,
    submittedAt: true,
    reviewedAt: true,
  } satisfies Prisma.VerificationSelect;

  return {
    async studentExists(userId) {
      
      const student = await client.student.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      return student !== null;
    },

    async getRole(userId) {
      const assignment = await client.userRoleAssignment.findUnique({
        where: { userId },
        select: { role: true },
      });
      return assignment?.role;
    },

    async assignRole(userId, role) {
      return client.userRoleAssignment.upsert({
        where: { userId },
        create: { userId, role },
        update: { role },
        select: { userId: true, role: true, updatedAt: true },
      });
    },

    async getVerificationStatus(userId) {
      const verification = await client.verification.findUnique({
        where: { studentId: userId },
        select: { status: true },
      });
      return verification?.status;
    },

    async getVerification(userId) {
      return (await client.verification.findUnique({
        where: { studentId: userId },
        select: verificationSelect,
      })) ?? undefined;
    },

    async listPendingVerifications() {
      return client.verification.findMany({
        where: { status: VerificationStatus.CHO_DUYET },
        orderBy: [{ submittedAt: 'asc' }, { studentId: 'asc' }],
        select: verificationSelect,
      });
    },

    async submitVerification(userId, cardStoragePath) {
      const result = await client.verification.updateMany({
        where: {
          studentId: userId,
          status: {
            in: [VerificationStatus.CHUA_XAC_THUC, VerificationStatus.TU_CHOI],
          },
        },
        data: {
          cardStoragePath,
          status: VerificationStatus.CHO_DUYET,
          reviewerId: null,
          rejectionReason: null,
          submittedAt: new Date(),
          reviewedAt: null,
        },
      });

      if (result.count === 0) return undefined;

      return (await client.verification.findUnique({
        where: { studentId: userId },
        select: verificationSelect,
      })) ?? undefined;
    },

    async reviewVerification(userId, reviewerId, status, rejectionReason) {
      const result = await client.verification.updateMany({
        where: { studentId: userId, status: VerificationStatus.CHO_DUYET },
        data: {
          status,
          reviewerId,
          rejectionReason: status === VerificationStatus.TU_CHOI ? rejectionReason : null,
          reviewedAt: new Date(),
        },
      });

      if (result.count === 0) return undefined;

      return (await client.verification.findUnique({
        where: { studentId: userId },
        select: {
          studentId: true,
          status: true,
          reviewerId: true,
          rejectionReason: true,
          reviewedAt: true,
        },
      })) ?? undefined;
    },
  };
}

export const userRepository = createUserRepository();
