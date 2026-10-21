const status = () => document.getElementById("status")!;

export function showWaiting() {
  status().dataset.state = "waiting";
  status().textContent = "のれんの前";
}

export function showGuests(count: number) {
  status().dataset.state = "open";
  status().textContent = `いま店内 ${count}人`;
}

export function showError(message: string) {
  status().dataset.state = "error";
  status().textContent = message;
}
