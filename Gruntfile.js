module.exports =function(grunt){
    grunt.initConfig({
        htmlhint:{
            options:{
                htmlhintrc: '.htmlhintrc'
            },
            src:'*.html'
        },
        csslint:{
            options:{
                csslintrc:'.csslintrc'
            },
            src:'*.css'
        },
        eslint:{
            options:{
                configFile:'.eslintrc.json'
            },
            target:["*.js"]
        }
    })

    grunt.loadNpmTasks('grunt-htmlhint');
    grunt.loadNpmTasks('grunt-contrib-csslint');
    grunt.loadNpmTasks('grunt-eslint');

    grunt.registerTask('lint',['htmlhint','csslint','eslint']);
}