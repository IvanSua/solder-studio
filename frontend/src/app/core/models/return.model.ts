export interface ReturnRequest {
  id: number;
  orderId: number;
  reason: string;
  description: string | null;
  resolution: string;
  status: ReturnStatus;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface CreateReturnRequest {
  orderId: number;
  reason: string;
  description?: string;
  resolution: 'REFUND' | 'EXCHANGE';
}
