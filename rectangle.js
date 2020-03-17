/*global $:true*/
// 小数点后面保留第 n 位
function roundFractional(x, n) {
    return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
}
$(function(){
    //程序思路
    //get dom elem
    var $width  = $('#width'),//css选择器代码
        $height = $('#height'),
        $btnCal = $('#calculate'),
        $perimeter = $('#perimeter'),
        $area = $('#area');
    /*calc button click event */
    $btnCal.click(function(){
        //get value
        var w = Number($width.val()),
            h = Number($height.val());
        //calculate
        var p = 2*(w+h),
            a=w*h;
        //output
        $perimeter.val(roundFractional(p,6));
        $area.val(roundFractional(a,6));
    });       
});