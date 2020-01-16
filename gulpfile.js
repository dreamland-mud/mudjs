
const argv = require('yargs').argv;
const gulpif = require('gulp-if');
const gulp = require('gulp');
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const uglify = require('gulp-uglify');
const buffer = require('vinyl-buffer');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');

gulp.task('default', function(){
    return browserify('./src/index.js', {
            debug: true
        })
        .transform(babelify, {
            presets: ['@babel/preset-env', '@babel/preset-react'],
            sourceMaps: true
        })
        .bundle()
        .pipe(source('build.js'))
        .pipe(buffer())
        .pipe(rename('bundle.js'))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('./dist'));
});
