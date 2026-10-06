import { describe, expect, it } from "vitest";
import { csvToRows, normalizeName, parseCsv, parseFlexibleDate, pickCell } from "./csv";

describe("parseCsv", () => {
  it("aspas, vírgula dentro do campo, BOM e CRLF", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","diz ""oi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'diz "oi"'],
    ]);
  });

  it("detecta ponto e vírgula (Excel pt-BR)", () => {
    expect(parseCsv("nome;sigla\n3º A;3A")).toEqual([
      ["nome", "sigla"],
      ["3º A", "3A"],
    ]);
  });
});

describe("csvToRows / pickCell", () => {
  it("normaliza cabeçalho e aceita apelidos", () => {
    const rows = csvToRows("Nome,Home Team Id\n\nTurma A,abc\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(3);
    expect(pickCell(rows[0], ["name", "nome"])).toBe("Turma A");
    expect(pickCell(rows[0], ["homeTeamId"])).toBe("abc");
    expect(pickCell(rows[0], ["sigla"])).toBe("");
  });
});

describe("normalizeName", () => {
  it("ignora acento, caixa e espaços", () => {
    expect(normalizeName("  Pátio  Central ")).toBe(normalizeName("patio central"));
  });
});

describe("parseFlexibleDate", () => {
  it("aceita dd/mm/aaaa e ISO, com hora", () => {
    expect(parseFlexibleDate("5/3/2026", "9:30")).toEqual({ scheduledDate: "2026-03-05", scheduledTime: "09:30", valid: true });
    expect(parseFlexibleDate("2026-10-12", "")).toEqual({ scheduledDate: "2026-10-12", scheduledTime: null, valid: true });
  });

  it("vazio = a definir; data impossível = inválida", () => {
    expect(parseFlexibleDate("", "")).toMatchObject({ scheduledDate: null, valid: true });
    expect(parseFlexibleDate("31/02/2026", "").valid).toBe(false);
    expect(parseFlexibleDate("12/10/2026", "25:00").valid).toBe(false);
  });
});
