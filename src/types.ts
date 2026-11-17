export type OrganizationOption = {
  id: string;
  name: string;
  sector: string;
  ninea: string;
  city: string;
};

export type ContactType = 'CLIENT' | 'SUPPLIER';

export interface CrmContact {
  id: string;
  type: ContactType;
  name: string;
  email: string;
  phone: string;
  ninea: string;
  address: string;
}

export type DocumentKind =
  | 'QUOTE'
  | 'CUSTOMER_ORDER'
  | 'DELIVERY_NOTE'
  | 'CUSTOMER_INVOICE'
  | 'PURCHASE_ORDER'
  | 'SUPPLIER_INVOICE';

export type DocumentStatus = 'DRAFT' | 'VALIDATED' | 'PARTIAL' | 'DELIVERED' | 'PAID';

export interface DocumentLine {
  id: string;
  label: string;
  quantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface DocumentPayment {
  id: string;
  date: string;
  amount: number;
  method: 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';
  reference: string;
}

export interface CommercialDocument {
  id: string;
  kind: DocumentKind;
  number: string;
  date: string;
  contactId: string;
  contactName: string;
  status: DocumentStatus;
  lines: DocumentLine[];
  payments: DocumentPayment[];
  notes: string;
}

export interface EventRecord {
  id: string;
  title: string;
  client: string;
  date: string;
  venue: string;
  capacity: number;
  registered: number;
  budgetFcfa: number;
  status: 'PLANIFIE' | 'EN_COURS' | 'TERMINE';
}

export interface TrainingProgram {
  id: string;
  title: string;
  category: string;
  durationHours: number;
  nextSession: string;
  enrolled: number;
  maxSeats: number;
  feeFcfa: number;
  certified: boolean;
}
