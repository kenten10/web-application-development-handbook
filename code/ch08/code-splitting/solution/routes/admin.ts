const auditRows = Array.from({ length: 100 }, (_, index) => `event-${index}`);
export function render(): string { return `<h1>Admin chunk</h1><p>${auditRows.length} audit events</p>`; }
