import { RestablecerForm } from "@/components/restablecer-form"

// Pagina del enlace del mail: /restablecer?code=...
export default async function RestablecerPage({ searchParams }: PageProps<"/restablecer">) {
  const { code } = await searchParams
  return <RestablecerForm code={typeof code === "string" ? code : ""} />
}
