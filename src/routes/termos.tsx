import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
const BRAND_NAME = "MenuAtlas";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: `Termos de Uso — ${BRAND_NAME}` },
      { name: "description", content: `Termos de uso da plataforma de pedidos ${BRAND_NAME}.` },
      { property: "og:title", content: `Termos de Uso — ${BRAND_NAME}` },
      { property: "og:description", content: `Termos de uso da plataforma de pedidos ${BRAND_NAME}.` },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
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
          <h1 className="text-lg font-bold">Termos de Uso</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Termos de Uso</div>
              <div className="text-xs text-foreground/60">
                Última atualização: {new Date().toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none space-y-5 text-sm leading-relaxed text-foreground/80">
            <Section title="1. Aceitação dos termos">
              Ao criar uma conta ou realizar um pedido em nossa plataforma, você concorda com estes Termos de Uso e
              com a nossa <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
              Se você não concorda, por favor, não utilize o serviço.
            </Section>

            <Section title="2. Cadastro e conta">
              Para finalizar pedidos você deve informar dados pessoais verdadeiros e atualizados (nome, e-mail, telefone e
              endereço de entrega). Você é responsável por manter a confidencialidade da sua senha e por todas as atividades
              realizadas na sua conta.
            </Section>

            <Section title="3. Pedidos e pagamentos">
              Os pedidos são processados pelo restaurante e o pagamento é intermediado pelos provedores contratados. Valores,
              disponibilidade de produtos, taxa de entrega e prazo estimado podem variar. O restaurante pode recusar pedidos
              em caso de indisponibilidade, área de entrega fora de cobertura ou suspeita de fraude.
            </Section>

            <Section title="4. Cancelamento e reembolso">
              O cancelamento é possível enquanto o pedido não estiver em preparo. Após esse momento, entre em contato com o
              restaurante. Reembolsos, quando aplicáveis, seguem as regras da forma de pagamento utilizada.
            </Section>

            <Section title="5. Conduta do usuário">
              Você concorda em não utilizar a plataforma para fins ilícitos, não tentar acessar áreas restritas, não realizar
              engenharia reversa e não enviar conteúdo ofensivo em avaliações ou observações.
            </Section>

            <Section title="6. Propriedade intelectual">
              Marca, layout, fotos, textos e software são de propriedade dos seus respectivos titulares e não podem ser
              copiados sem autorização.
            </Section>

            <Section title="7. Limitação de responsabilidade">
              Nos esforçamos para manter o serviço disponível, mas não garantimos ausência de falhas. Não somos responsáveis
              por danos indiretos decorrentes do uso da plataforma, respeitados os direitos previstos no Código de Defesa
              do Consumidor.
            </Section>

            <Section title="8. Alterações">
              Estes termos podem ser atualizados a qualquer momento. Alterações relevantes serão comunicadas no aplicativo.
            </Section>

            <Section title="9. Contato">
              Dúvidas sobre estes termos? Fale com {BRAND_NAME} pelos canais de atendimento informados no rodapé.
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
      <p>{children}</p>
    </div>
  );
}
