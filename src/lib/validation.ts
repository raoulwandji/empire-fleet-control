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

export const paymentCreateSchema = z
  .object({
    driverId: z.string(),
    date: z.string(), // ISO
    amount: z.number().nonnegative(),
    paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE', 'PORTEFEUILLE']).default('ESPECES'),
    comment: z.string().optional(),
    // Jour à 0 FCFA car le véhicule n'a pas été exploité (panne, entretien, indisponibilité...).
    isInactive: z.boolean().optional().default(false),
    inactivityReason: z.string().optional(),
    // Mouvement de portefeuille optionnel, intégré au moment de la saisie du versement (CV uniquement) :
    // DEPOT pour garder un surplus, RETRAIT pour couvrir une partie du versement avec le solde existant.
    walletMovement: z
      .object({
        type: z.enum(['DEPOT', 'RETRAIT']),
        amount: z.number().positive(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isInactive && !data.inactivityReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inactivityReason'],
        message: 'Un motif est requis pour un jour inactif.',
      });
    }
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

const businessUnitEnum = z.enum([
  'EMPIRE_ASSURANCE',
  'AUTO_ECOLE_EMPIRE',
  'EMPIRE_LANGUAGE_ACADEMY',
  'EMPIRE_TRAVEL',
  'EMPIRE_DRIVE',
  'EMPIRE_SECURE',
]);

export const productCreateSchema = z.object({
  businessUnit: businessUnitEnum,
  name: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  quantityInStock: z.number().int().nonnegative().default(0),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  unitPrice: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

export const stockMovementCreateSchema = z
  .object({
    productId: z.string(),
    type: z.enum(['APPRO', 'VENTE', 'AJUSTEMENT']),
    // Pour APPRO/VENTE : quantité positive. Pour AJUSTEMENT : peut être négative (correction à la baisse).
    quantity: z.number().int(),
    unitPrice: z.number().nonnegative().optional(),
    date: z.string(),
    note: z.string().optional(),
    // Pour un APPRO : générer aussi une sortie comptable correspondant au coût d'achat.
    recordCost: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'AJUSTEMENT' && data.quantity <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'La quantité doit être positive.' });
    }
    if (data.type === 'AJUSTEMENT' && data.quantity === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: "La quantité d'ajustement ne peut pas être nulle." });
    }
  });

export const structureServiceEntrySchema = z.object({
  businessUnit: businessUnitEnum,
  serviceName: z.string().min(1),
  amount: z.number().positive(),
  date: z.string(),
  note: z.string().optional(),
  paymentMode: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'AUTRE', 'PORTEFEUILLE']).optional().default('ESPECES'),
});

export const structureAssignmentCreateSchema = z.object({
  userId: z.string(),
  businessUnit: businessUnitEnum,
});

const garageReasonTypeEnum = z.enum(['PANNE', 'REPARATION', 'ENTRETIEN', 'ACCIDENT', 'AUTRE']);

export const garageEntryCreateSchema = z.object({
  driverId: z.string(),
  reasonType: garageReasonTypeEnum,
  reason: z.string().min(1),
  enteredAt: z.string(),
  note: z.string().optional(),
});

export const garageEntryUpdateSchema = z.object({
  reasonType: garageReasonTypeEnum.optional(),
  reason: z.string().min(1).optional(),
  enteredAt: z.string().optional(),
  note: z.string().optional(),
});
