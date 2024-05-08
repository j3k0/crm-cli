export const designDocument =
{
  "_id": "_design/companies",
  "views": {
    "by_name": {
      "map": "function (doc) {\n  if (doc._id.slice(0, 7) !== \"company\") return;\n  emit(doc.name, 1);\n}"
    },
    "by_app_name": {
      "map": "function (doc) {\n  if (doc._id.slice(0, 7) !== \"company\") return;\n  (doc.apps || []).forEach(app => {\n    if (app.appName) {\n      emit(app.appName, 1);\n    }\n  });\n}"
    },
    "by_email": {
      "map": "function (doc) {\n  if (doc._id.slice(0, 7) !== \"company\") return;\n  const emails = {};\n  (doc.apps || []).forEach(app => {\n    if (app.email)\n      emails[app.email] = 1;\n  });\n  (doc.contacts || []).forEach(contact => {\n    if (contact.email)\n      emails[contact.email] = 1;\n  });\n  Object.keys(emails).forEach(email => emit(email, 1));\n}"
    }
  },
  "language": "javascript"
}