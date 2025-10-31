export interface RunnerItem {
  PK: string;                    // "ORG#organizer123"
  SK: string;                    // "RUN#event456#bib789"

  organizer_id: string;
  event_id: string;
  bib_number: string;
  runner_name?: string;
  runner_email?: string;
  runner_phone?: string;
  created_at: string;
  updated_at: string;
}

