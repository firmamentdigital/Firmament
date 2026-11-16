import type { ChildAffiliation } from "./affiliation";

export type GuardianInput = {
  key: string;
  fullName: string;
  birthDate: string;
  attending: boolean;
  /** Celular próprio do segundo responsável. */
  phone?: string;
};

export type ChildInput = {
  fullName: string;
  birthDate: string;
  affiliation: ChildAffiliation;
  guardianKeys: string[];
};

export type RegistrationInput = {
  requestId: string;
  phone: string;
  guardians: GuardianInput[];
  children: ChildInput[];
  question: string;
  confirmed: boolean;
};

export type RegistrationReceipt = {
  code: string;
  children: number;
  accompanyingGuardians: number;
  totalPeople: number;
};

export type Participant = {
  id: string;
  kind: "child" | "guardian";
  affiliation: ChildAffiliation | null;
  fullName: string;
  birthDate: string;
  age: number;
  phone: string;
  familyCodes: string[];
  familyIds: string[];
  linkedNames: string[];
  checkedInAt: string | null;
  version: number;
};

export type FamilyDetail = {
  id: string;
  code: string;
  phone: string;
  primaryGuardianName: string;
  createdAt: string;
  status: "active" | "cancelled";
  version: number;
  children: {
    id: string; fullName: string; birthDate: string; age: number;
    affiliation: ChildAffiliation | null;
    checkedInAt: string | null; guardianNames: string[];
  }[];
  guardians: {
    id: string; fullName: string; birthDate: string; age: number;
    attending: boolean; checkedInAt: string | null;
    primary: boolean; phone: string | null;
  }[];
  questions: { text: string; createdAt: string }[];
};

export type EventSnapshot = {
  participants: Participant[];
  families: FamilyDetail[];
  stats: {
    families: number; children: number; guardians: number;
    expected: number; present: number; questions: number;
    cancelledFamilies: number;
  };
  updatedAt: string;
};
