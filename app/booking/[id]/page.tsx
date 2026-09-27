import { notFound } from "next/navigation";
import { Booking } from "@/components/Booking";
export const metadata = {
  title: "Your reservation",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <Booking id={id} />;
}
