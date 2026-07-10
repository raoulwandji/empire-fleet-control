import { z } from 'zod';

// Toutes les informations sont obligatoires à la création, sauf la partie
// "sanction" (taux de pénalité / objectif d'heures), qui reste optionnelle.
const driverBaseSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  location: z.string().min(1),
  licenseNumber: z.string().min(1),
  contractType: z.enum(['CONDITION_VENTE', 'LOCATION']),
  ownerId: z.string().optional(),
  ownerName: z.string().min(2),
  ownerPhone: z.string().min(6),
  ownerLocation: z.string().optional(),
  guarantorName: z.string().min(1),
  guarantorPhone: z.string().min(6),
  vehicleBrand: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehiclePlate: z.string().min(1),
  vehicleColor: z.string().min(1),
  vehicleInService: z.string().min(1), // ISO date string
  totalPriceFixed: z.number().positive().optional(),
  cautionReference: z.number().nonnegative().optional(),
  cautionMinThreshold: z.number().nonnegative().optional(),
  // Partie sanction — non obligatoire
  hourlyPenaltyRate: z.number().nonnegative().default(0).optional(),
  weeklyHourTarget: z.number().int().positive().default(55).optional(),
});

export const driverCreateSchema = driverBaseSchema.superRefine((data, ctx) => {
  if (data.contractType === 'CONDITION_VENTE' && !data.totalPriceFixed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalPriceFixed'],
      message: 'Le montant total fixé est obligatoire pour un contrat Condition-Vente.',
    });
  }
  if (data.contractType === 'LOCATION' && !data.cautionReference) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cautionReference'],
      message: 'La caution de référence est obligatoire pour un contrat Location.',
    });
  }
});

export const driverUpdateSchema = driverBaseSchema.partial();

export const paymentCreateSchema = z.object({
  driverId: z.string(),
  date: z.string(), // ISO
  amount: z.number().positive(),
  paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE']).default('ESPECES'),
  comment: z.string().optional(),
  // Mouvement de portefeuille optionnel, intégré au moment de la saisie du versement (CV uniquement) :
  // DEPOT pour garder un surplus, RETRAIT pour couvrir une partie du versement avec le solde existant.
  walletMovement: z
    .object({
      type: z.enum(['DEPOT', 'RETRAIT']),
      amount: z.number().positive(),
    })
    .optional(),
});

export const cautionMovementCreateSchema = z.object({
  driverId: z.string(),
  date: z.string(),
  type: z.enum([
    'DEPOT_INITIAL',
    'RECHARGE_VOLONTAIRE',
    'DEDUCTION_PANNE',
    'DEDUCTION_SANCTION',
    'RETRAIT',
  ]),
  amount: z.number(),
  reason: z.string().optional(),
});

export const walletMovementCreateSchema = z.object({
  driverId: z.string(),
  date: z.string(),
  type: z.enum(['DEPOT', 'RETRAIT']),
  amount: z.number().positive(),
  reason: z.string().optional(),
});

export const weeklyTrackingCreateSchema = z.object({
  driverId: z.string(),
  weekStartDate: z.string(),
  hoursWorked: z.number().nonnegative(),
  ridesCompleted: z.number().int().nonnegative(),
});

export const commentCreateSchema = z.object({
  driverId: z.string(),
  text: z.string().min(1),
});

export const userCreateSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
});

export const assignmentCreateSchema = z.object({
  employeeId: z.string(),
  driverId: z.string(),
});

export const pendingDriverCreateSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  location: z.string().optional(),
  licenseNumber: z.string().optional(),
  contractType: z.enum(['CONDITION_VENTE', 'LOCATION']),
  cautionPaid: z.number().nonnegative().default(0),
  comment: z.string().optional(),
});

export const pendingDriverUpdateSchema = pendingDriverCreateSchema.partial();

export const pendingDriverCommentCreateSchema = z.object({
  pendingDriverId: z.string(),
  text: z.string().min(1),
});

export const ownerCommentCreateSchema = z.object({
  ownerId: z.string(),
  text: z.string().min(1),
});

export const pendingOwnerCreateSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  location: z.string().optional(),
  comment: z.string().optional(),
});

export const pendingOwnerUpdateSchema = pendingOwnerCreateSchema.partial();

export const pendingOwnerCommentCreateSchema = z.object({
  pendingOwnerId: z.string(),
  text: z.string().min(1),
});
