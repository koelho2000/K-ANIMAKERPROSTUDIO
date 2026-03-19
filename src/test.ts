const selectedEvent: any = undefined;
try {
  console.log(selectedEvent?.take.id);
} catch (e: any) {
  console.error("Error:", e.message);
}
