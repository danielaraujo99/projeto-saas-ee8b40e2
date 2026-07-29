import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
const BRAND_NAME = "MenuAtlas";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: `Política de Privacidade — ${BRAND_NAME}` },
      { name: "description", content: `Como o ${BRAND_NAME} coleta, usa e protege seus dados pessoais.` },
      { property: "og:title", content: `Política de Privacidade — ${BRAND_NAME}` },
      { property: "og:description", content: `Como o ${BRAND_NAME} coleta, usa e protege seus dados pessoais.` },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pt-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:static md:border-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label="Voltar"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground/70 hover:bg-surface md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold">Política de Privacidade</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Política de Privacidade</div>
              <div className="text-xs text-foreground/60">
                Última atualização: {new Date().toLocaleDateString("pt-BR")} · Em conformidade com a LGPD (Lei 13.709/2018)
              </div>
            </div>
          </div>

          <div className="space-y-5 text-sm leading-relaxed text-foreground/80">
            <Section title="1. Quem somos">
              Esta política descreve como o {BRAND_NAME}, na condição de controlador dos dados, trata as informações
              pessoais coletadas por meio desta plataforma.
            </Section>

            <Section title="2. Dados que coletamos">
              <ul className="ml-5 list-disc space-y-1">
                <li>Dados cadastrais: nome, e-mail e telefone informados no cadastro.</li>
                <li>Endereços de entrega salvos.</li>
                <li>Histórico de pedidos, avaliações e cupons utilizados.</li>
                <li>Dados de pagamento tratados pelos provedores contratados (nós não armazenamos o número completo do cartão).</li>
                <li>Dados de navegação: identificador do dispositivo, páginas visitadas e cookies estritamente necessários.</li>
              </ul>
            </Section>

            <Section title="3. Base legal e finalidade">
              Tratamos seus dados para executar o contrato de compra e entrega, cumprir obrigações legais e fiscais, prevenir
              fraudes e, mediante seu consentimento, para melhorar sua experiência (analytics e comunicação de novidades).
            </Section>

            <Section title="4. Cookies e tecnologias similares">
              Utilizamos cookies necessários para o funcionamento do carrinho e da sessão, e cookies opcionais de análise
              para entender como a plataforma é usada. Você controla os cookies opcionais pelo banner de consentimento
              exibido no seu primeiro acesso.
            </Section>

            <Section title="5. Compartilhamento">
              Compartilhamos apenas os dados necessários com: operadores de pagamento, entregadores parceiros e provedores de
              infraestrutura em nuvem. Não vendemos seus dados.
            </Section>

            <Section title="6. Retenção">
              Mantemos seus dados enquanto sua conta estiver ativa e pelo tempo exigido pela legislação fiscal (até 5 anos
              para documentos de venda), a contar da última interação.
            </Section>

            <Section title="7. Seus direitos (LGPD)">
              Você pode a qualquer momento solicitar acesso, correção, portabilidade, anonimização e exclusão dos seus dados,
              bem como revogar consentimentos. A exclusão da conta e dos dados locais pode ser feita direto na
              tela <Link to="/conta" className="text-primary underline">Conta</Link>. Para pedidos adicionais, fale com nosso
              encarregado (DPO) pelos canais de atendimento.
            </Section>

            <Section title="8. Segurança">
              Adotamos medidas técnicas e administrativas para proteger seus dados, incluindo criptografia em trânsito,
              controle de acesso e políticas de RLS no banco de dados. Nenhum sistema é 100% seguro; comunicaremos incidentes
              relevantes na forma da lei.
            </Section>

            <Section title="9. Alterações">
              Esta política pode ser atualizada. Alterações relevantes serão comunicadas no aplicativo.
            </Section>

            <Section title="10. Contato do Encarregado (DPO)">
              Para exercer seus direitos ou tirar dúvidas sobre privacidade, entre em contato pelos canais de atendimento
              informados no rodapé do site.
            </Section>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-bold text-foreground">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
