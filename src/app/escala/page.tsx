"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  rotuloDia,
  somarDias,
} from "@/lib/datas";

type CelulaAberta = { data: string; turno: Turno };

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [celula, setCelula] = useState<CelulaAberta | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null); // funcionário sendo salvo

  const dias = diasDaSemana(segunda);
  const hoje = hojeISO();

  const carregar = useCallback(async (inicio: string) => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não foram configuradas. Veja a tela Início.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const db = supabase();
    const [t, f, e] = await Promise.all([
      db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
      db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      db
        .from("escalas")
        .select("id, data, turno_id, funcionario_id")
        .gte("data", inicio)
        .lte("data", somarDias(inicio, 6)),
    ]);
    const falha = t.error || f.error || e.error;
    if (falha) {
      setErro(`Não foi possível carregar a escala: ${falha.message}`);
    } else {
      setTurnos(t.data as Turno[]);
      setFuncionarios(f.data as Funcionario[]);
      setEscalas(e.data as Escala[]);
      setErro(null);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar(segunda);
  }, [segunda, carregar]);

  function escaladosNa(data: string, turnoId: string): Funcionario[] {
    const ids = new Set(
      escalas.filter((e) => e.data === data && e.turno_id === turnoId).map((e) => e.funcionario_id),
    );
    return funcionarios.filter((f) => ids.has(f.id));
  }

  async function alternar(funcionario: Funcionario, data: string, turnoId: string) {
    setOcupado(funcionario.id);
    const existente = escalas.find(
      (e) => e.data === data && e.turno_id === turnoId && e.funcionario_id === funcionario.id,
    );
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) setErro(`Não foi possível tirar da escala: ${error.message}`);
      else setEscalas((atual) => atual.filter((e) => e.id !== existente.id));
    } else {
      const { data: nova, error } = await db
        .insert({ data, turno_id: turnoId, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) setErro(`Não foi possível colocar na escala: ${error.message}`);
      else setEscalas((atual) => [...atual, nova as Escala]);
    }
    setOcupado(null);
  }

  // Na janela aparecem os ativos e também quem já está escalado (mesmo desativado),
  // para que seja possível tirá-lo da escala.
  const listaDaCelula = celula
    ? funcionarios.filter(
        (f) =>
          f.ativo ||
          escalas.some(
            (e) =>
              e.data === celula.data &&
              e.turno_id === celula.turno.id &&
              e.funcionario_id === f.id,
          ),
      )
    : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="cartao flex items-center justify-between gap-2">
        <button
          className="botao-secundario"
          onClick={() => setSegunda(somarDias(segunda, -7))}
          aria-label="Semana anterior"
        >
          ◀ <span className="ml-1 hidden sm:inline">Anterior</span>
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold">
            {diaMes(dias[0])} a {diaMes(dias[6])}
          </p>
          {segunda !== inicioDaSemana(hoje) && (
            <button
              className="text-sm underline"
              onClick={() => setSegunda(inicioDaSemana(hoje))}
            >
              Voltar para esta semana
            </button>
          )}
        </div>
        <button
          className="botao-secundario"
          onClick={() => setSegunda(somarDias(segunda, 7))}
          aria-label="Próxima semana"
        >
          <span className="mr-1 hidden sm:inline">Próxima</span> ▶
        </button>
      </div>

      {erro && (
        <p className="cartao border-red-300 bg-red-50 text-red-800" role="alert">
          {erro}
        </p>
      )}

      {carregando && turnos.length === 0 ? (
        <p className="text-neutral-600">Carregando escala...</p>
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            {carregando
              ? "Atualizando..."
              : "Toque em um quadro para escolher quem trabalha. Arraste a grade para o lado para ver todos os dias."}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-white p-2 text-left">Turno</th>
                  {dias.map((d) => (
                    <th
                      key={d}
                      className={`min-w-[7rem] p-2 text-center ${
                        d === hoje ? "bg-principal text-white" : ""
                      }`}
                    >
                      {rotuloDia(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {turnos.map((turno) => (
                  <tr key={turno.id} className="border-t border-neutral-200">
                    <th className="sticky left-0 z-[1] bg-white p-2 text-left align-top">
                      <span className="block text-base">{turno.nome}</span>
                      <span className="block text-xs font-normal text-neutral-600">
                        {horaCurta(turno.hora_inicio)}–{horaCurta(turno.hora_fim)}
                      </span>
                    </th>
                    {dias.map((d) => {
                      const escalados = escaladosNa(d, turno.id);
                      return (
                        <td key={d} className="border-l border-neutral-200 p-1 align-top">
                          <button
                            className="flex min-h-[5rem] w-full flex-col items-start gap-1 rounded-lg p-2 text-left active:bg-neutral-100"
                            onClick={() => setCelula({ data: d, turno })}
                            aria-label={`${turno.nome} de ${rotuloDia(d)}: ${escalados.length} pessoas`}
                          >
                            {escalados.length === 0 ? (
                              <span className="text-neutral-400">+ Escolher</span>
                            ) : (
                              escalados.map((f) => (
                                <span key={f.id} className="leading-tight">
                                  {f.nome.split(" ")[0]}
                                </span>
                              ))
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {celula && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCelula(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold">
              {celula.turno.nome} · {DIAS_SEMANA[paraData(celula.data).getDay()]}{" "}
              {diaMes(celula.data)}
            </h2>
            <p className="mb-3 text-sm text-neutral-600">
              Marque quem trabalha. Cada toque já fica salvo.
            </p>
            <ul className="space-y-2">
              {listaDaCelula.map((f) => {
                const marcado = escalas.some(
                  (e) =>
                    e.data === celula.data &&
                    e.turno_id === celula.turno.id &&
                    e.funcionario_id === f.id,
                );
                return (
                  <li key={f.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        marcado ? "border-principal bg-secundaria" : "border-neutral-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-6 w-6 accent-principal"
                        checked={marcado}
                        disabled={ocupado !== null}
                        onChange={() => alternar(f, celula.data, celula.turno.id)}
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{f.nome}</span>
                        <span className="block text-sm text-neutral-600">
                          {f.funcao}
                          {!f.ativo && " · desativado"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button className="botao mt-4 w-full" onClick={() => setCelula(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
