function copyUser(user) {
  return user ? { ...user } : null;
}

function createUserRepository(initialUsers = []) {
  const storedUsers = initialUsers.map(copyUser);

  return {
    async create(user) {
      const copy = copyUser(user);
      storedUsers.push(copy);
      return copyUser(copy);
    },

    async findByEmail(email) {
      return copyUser(storedUsers.find((user) => user.email === email));
    },

    async findById(id) {
      return copyUser(storedUsers.find((user) => user.id === id));
    },
  };
}

module.exports = { createUserRepository };
