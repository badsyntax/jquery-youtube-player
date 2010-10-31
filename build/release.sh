#!/usr/bin/env bash
#
# @description : this BASH script is used to build the jquery youtube player plugin
# @author : Richard Willis
# @project : http://github.com/badsyntax/jquery-youtube-player
# @requirements : curl, zip, git, rhino

echo -n "Enter the version for this release: "

read ver

if [ ! $ver ]; then 

	echo "Invalid version."

	exit
fi

#echo "Checking.."

#lint=$(js jslint.js ../js/jquery.youtube.player.js)

echo "Building.."

name=jquery-youtube-player
in=../js/jquery.youtube.player.js
out=../js/jquery.youtube.player.min.js
thedate=$(date)

cat copywrite | sed "s/\${ver}/$ver/g;s/\${time}/$thedate/g" > $out

curl -s \
	-d compilation_level=SIMPLE_OPTIMIZATIONS \
	-d output_format=text \
	-d output_info=compiled_code \
	--data-urlencode "js_code@${in}" \
	http://closure-compiler.appspot.com/compile \
	>> $out

git add $out && git commit -m "added ${ver} min version"

rm -rf "${name}-${ver}" && mkdir "${name}-${ver}" && cd "${name}-${ver}"

cp -r ../../js/ .
cp -r ../../css/ .
cp -r ../../examples/ .
cp ../../index.html .
cp ../../README.md .

cd ../

zip -r "${name}-${ver}.zip" "${name}-${ver}"

rm -rf "${name}-${ver}"

git add "${name}-${ver}.zip" && git commit -m "added v${ver} release archive" && git push

cd ../

git tag -a $ver -m "tagged version ${ver}" && git push --tags

echo "done."
