export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export function isAdult(dob: Date, minAge = 18, now: Date = new Date()): boolean {
  return ageFromDob(dob, now) >= minAge
}
