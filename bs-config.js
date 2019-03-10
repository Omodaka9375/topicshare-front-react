module.exports = {
    port: process.env.PORT || 8000,
    notify: false,
    ghostMode: false, 
    codeSync: false,
    files: ['.src/**/*.{html,htm,css,js}'],
    server:{
      baseDir: ["./src", "./build/contracts"]
    }};