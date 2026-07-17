/**
 * Roles are gender-fixed in this model: baby = woman seeking men,
 * benefactor = man seeking women. Same-gender arrangements are out of scope.
 * The signup fork sets the role; gender and looking-for follow from it, so
 * the wizard never asks them.
 */
export function identityForRole(role: 'benefactor' | 'baby'): {
  gender: 'male' | 'female'
  looking_for: 'male' | 'female'
} {
  return role === 'baby'
    ? { gender: 'female', looking_for: 'male' }
    : { gender: 'male', looking_for: 'female' }
}
