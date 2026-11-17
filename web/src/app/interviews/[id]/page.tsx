import { InterviewRoom } from '@/features/interviews/InterviewRoom'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InterviewRoom id={decodeURIComponent(id)} />
}
