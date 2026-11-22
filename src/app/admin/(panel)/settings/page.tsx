import { getSettings } from "@/lib/settings";
import { getOnlineProvider } from "@/lib/payments";
import { PageTitle } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const settings = await getSettings();
  const provider = getOnlineProvider();
  return (
    <>
      <PageTitle title="Настройки магазина" />
      <SettingsForm
        initial={settings}
        providerInfo={provider ? `Подключён: ${provider.title}${provider.id === "test" ? " (тестовый режим — только для разработки)" : ""}` : "Платёжный провайдер не подключён (см. PAYMENT_PROVIDER в .env). Онлайн-оплата не будет показана покупателям."}
        aiEnabled={!!process.env.ANTHROPIC_API_KEY}
      />
    </>
  );
}
