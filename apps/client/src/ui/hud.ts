const status = () => document.getElementById("status")!;

export function showConnecting() {
  status().dataset.state = "connecting";
  status().textContent = "入店中…";
}

export function showGuests(count: number) {
  status().dataset.state = "open";
  status().textContent = `いま店内 ${count}人`;
}

export function showError(message: string) {
  status().dataset.state = "error";
  status().textContent = message;
}
