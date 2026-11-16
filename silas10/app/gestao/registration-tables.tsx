"use client";

import { Check, ChevronRight, LoaderCircle, MessageSquareText } from "lucide-react";
import { affiliationLabel } from "@/lib/affiliation";
import { formatBirthDate, formatPhone } from "@/lib/event";
import type { FamilyDetail, Participant } from "@/lib/types";

function entryTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export function ParticipantTable({ people, busyId, onPresence, onOpenFamily }: {
  people: Participant[];
  busyId: string;
  onPresence: (person: Participant) => void;
  onOpenFamily: (id: string) => void;
}) {
  return <>
    <p className="table-scroll-hint">Uma pessoa por linha. No celular, deslize a tabela para ver todas as colunas.</p>
    <div className="management-table-shell" tabIndex={0} role="region" aria-label="Tabela de participantes com rolagem horizontal">
      <table className="management-data-table">
        <caption className="sr-only">Inscritos, responsáveis vinculados, contato, vínculo e controle de presença</caption>
        <thead><tr><th scope="col">Participante</th><th scope="col">Nascimento / idade</th><th scope="col">Responsável / crianças</th><th scope="col">Celular do responsável</th><th scope="col">Vínculo</th><th scope="col">Presença</th><th scope="col">Inscrição / ações</th></tr></thead>
        <tbody>{people.map(person => <tr key={person.id}>
          <th scope="row" className="table-person"><strong>{person.fullName}</strong><small>{person.kind === "child" ? "Criança / jovem" : "Responsável acompanhante"}</small></th>
          <td><span>{formatBirthDate(person.birthDate)}</span><small>{person.age} anos no encontro</small></td>
          <td className="table-linked"><span>{person.linkedNames.join(", ") || "—"}</span><small>{person.kind === "child" ? "Responsável vinculado" : "Crianças vinculadas"}</small></td>
          <td className="table-phone">{person.phone.split(" / ").map(phone => <a key={phone} href={"tel:+55" + phone}>{formatPhone(phone)}</a>)}</td>
          <td><span className={"table-affiliation" + (person.kind === "guardian" ? " muted" : "")}>{person.kind === "child" ? affiliationLabel(person.affiliation) : "Acompanhante"}</span></td>
          <td><button className={"table-presence-button" + (person.checkedInAt ? " checked" : "")} disabled={Boolean(busyId)} onClick={() => onPresence(person)} aria-label={(person.checkedInAt ? "Desfazer presença de " : "Registrar presença de ") + person.fullName}>
            {busyId === person.id ? <LoaderCircle size={16} className="spin" /> : person.checkedInAt ? <Check size={16} /> : <span className="table-check-box" />}
            {person.checkedInAt ? "Presente" : "Confirmar presença"}
          </button>{person.checkedInAt && <small className="table-entry-time">Entrada às {entryTime(person.checkedInAt)}</small>}</td>
          <td className="table-actions"><span className="table-family-code">{person.familyCodes.join(" · ")}</span><button className="table-edit-button" onClick={() => onOpenFamily(person.familyIds[0])} aria-label={"Ver ou editar inscrição de " + person.fullName}>Ver / editar <ChevronRight size={15} /></button>
            {person.familyIds.length > 1 && <select aria-label={"Outras inscrições de " + person.fullName} value="" onChange={e => { if (e.target.value) onOpenFamily(e.target.value); }}><option value="">Outras inscrições</option>{person.familyIds.map((id, index) => <option key={id} value={id}>{person.familyCodes[index]}</option>)}</select>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

export function FamilyTable({ families, onOpenFamily }: { families: FamilyDetail[]; onOpenFamily: (id: string) => void }) {
  return <>
    <p className="table-scroll-hint">Uma inscrição por linha, com todas as crianças e responsáveis da família. Deslize para ver mais.</p>
    <div className="management-table-shell" tabIndex={0} role="region" aria-label="Tabela de inscrições por família com rolagem horizontal">
      <table className="management-data-table family-data-table">
        <caption className="sr-only">Inscrições por família, crianças, responsáveis, celular, situação e presenças</caption>
        <thead><tr><th scope="col">Inscrição</th><th scope="col">Crianças e jovens</th><th scope="col">Responsáveis</th><th scope="col">Celular</th><th scope="col">Situação</th><th scope="col">Presenças</th><th scope="col">Ações</th></tr></thead>
        <tbody>{families.map(family => {
          const expected = family.children.length + family.guardians.filter(p => p.attending).length;
          const present = family.children.filter(p => p.checkedInAt).length + family.guardians.filter(p => p.attending && p.checkedInAt).length;
          return <tr key={family.id} className={family.status === "cancelled" ? "table-cancelled" : ""}>
            <th scope="row" className="table-person"><strong className="table-family-code">{family.code}</strong><small>{new Date(family.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small></th>
            <td className="table-children">{family.children.map(child => <div key={child.id}><strong>{child.fullName}</strong><small>{child.age} anos · {affiliationLabel(child.affiliation)}</small></div>)}</td>
            <td className="table-guardians">{[...family.guardians].sort((a, b) => Number(b.fullName === family.primaryGuardianName) - Number(a.fullName === family.primaryGuardianName)).map(person => <div key={person.id}><strong>{person.fullName}</strong><small>{person.attending ? "Acompanhará o encontro" : person.fullName === family.primaryGuardianName ? "Contato da família" : "Não irá ao encontro"}</small></div>)}</td>
            <td className="table-phone"><a href={"tel:+55" + family.phone}>{formatPhone(family.phone)}</a></td>
            <td><span className={"family-status " + family.status}>{family.status === "cancelled" ? "Cancelada" : "Ativa"}</span></td>
            <td><strong>{family.status === "cancelled" ? "—" : present + " de " + expected}</strong><small>{family.status === "cancelled" ? "Fora da recepção" : "pessoas presentes"}</small></td>
            <td className="table-actions"><button className="table-edit-button" onClick={() => onOpenFamily(family.id)} aria-label={"Ver ou editar inscrição " + family.code}>Ver / editar <ChevronRight size={15} /></button>{family.questions.length > 0 && <span className="table-observation"><MessageSquareText size={14} />Tem observação</span>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </>;
}
