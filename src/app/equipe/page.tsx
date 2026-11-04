"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = {
  id: string | null; // null = funcionário novo
  nome: string;
  funcao: string;
  telefone: string;
};

const formularioVazio: Formulario = {
  id: null,
  nome: "",
  funcao: FUNCOES_PADRAO[0],
  telefone: "",
};

function mensagemDeErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
}

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não foram configuradas. Veja a tela Início.");
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase()
      .from("funcionarios")
      .select("id, nome, funcao, telefone, cpf, ativo")
      .order("nome");
    if (error) setErro(`Não foi possível carregar a equipe: ${error.message}`);
    else {
      setFuncionarios(data as Funcionario[]);
      setErro(null);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;
    const nome = formulario.nome.trim();
    if (!nome) {
      setErro("Preencha o nome do funcionário.");
      return;
    }
    setSalvando(true);
    const dados = {
      nome,
      funcao: formulario.funcao,
      telefone: formulario.telefone.trim() || null,
    };
    try {
      const db = supabase().from("funcionarios");
      const { error } = formulario.id
        ? await db.update(dados).eq("id", formulario.id)
        : await db.insert(dados);
      if (error) throw error;
      setFormulario(null);
      await carregar();
    } catch (e) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(e)}`);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarAtivo(funcionario: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${funcionario.nome}? Ele(a) sai da lista da escala.`)) {
      return;
    }
    const { error } = await supabase()
      .from("funcionarios")
      .update({ ativo })
      .eq("id", funcionario.id);
    if (error) setErro(`Não foi possível atualizar: ${error.message}`);
    else await carregar();
  }

  const ativos = funcionarios.filter((f) => f.ativo);
  const inativos = funcionarios.filter((f) => !f.ativo);

  // Mostra também funções que já existem no banco e não estão na lista padrão.
  const funcoes = Array.from(
    new Set([...FUNCOES_PADRAO, ...funcionarios.map((f) => f.funcao)]),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {!formulario && (
          <button className="botao" onClick={() => setFormulario({ ...formularioVazio })}>
            + Adicionar funcionário
          </button>
        )}
      </div>

      {erro && (
        <p className="cartao border-red-300 bg-red-50 text-red-800" role="alert">
          {erro}
        </p>
      )}

      {formulario && (
        <form onSubmit={salvar} className="cartao space-y-4">
          <h2 className="text-lg font-semibold">
            {formulario.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              className="campo"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
              autoFocus
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Função</span>
            <select
              className="campo"
              value={formulario.funcao}
              onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
            >
              {funcoes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Telefone</span>
            <input
              className="campo"
              type="tel"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => setFormulario(null)}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <p className="text-neutral-600">Carregando equipe...</p>
      ) : (
        <>
          <section className="space-y-3">
            {ativos.length === 0 && (
              <p className="text-neutral-600">Nenhum funcionário ativo.</p>
            )}
            {ativos.map((f) => (
              <article key={f.id} className="cartao">
                <p className="text-lg font-semibold">{f.nome}</p>
                <p className="text-neutral-700">{f.funcao}</p>
                {f.telefone && (
                  <a href={`tel:${f.telefone.replace(/\D/g, "")}`} className="text-base underline">
                    {f.telefone}
                  </a>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    className="botao-secundario"
                    onClick={() => {
                      setFormulario({
                        id: f.id,
                        nome: f.nome,
                        funcao: f.funcao,
                        telefone: f.telefone ?? "",
                      });
                      // O formulário fica no topo da página.
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Editar
                  </button>
                  <button className="botao-secundario" onClick={() => mudarAtivo(f, false)}>
                    Desativar
                  </button>
                </div>
              </article>
            ))}
          </section>

          {inativos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-600">Desativados</h2>
              {inativos.map((f) => (
                <article key={f.id} className="cartao opacity-70">
                  <p className="text-lg font-semibold">{f.nome}</p>
                  <p className="text-neutral-700">{f.funcao}</p>
                  {f.telefone && <p>{f.telefone}</p>}
                  <button
                    className="botao-secundario mt-3 w-full"
                    onClick={() => mudarAtivo(f, true)}
                  >
                    Reativar
                  </button>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
